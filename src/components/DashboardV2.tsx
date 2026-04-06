"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import MarketBrief from "./MarketBrief";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import ExpandableChart from "./ui/ExpandableChart";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts";
import { GPU_DISPLAY_NAMES, PROVIDER_COLORS, costPerMillionFromGPU, inferenceMargin } from "@/lib/calculations";
import type {
  TokenPriceModel,
  GPUSummary,
  GPUThroughput,
  OrnnUtilizationHistory,
  OrnnOCPIPrices,
} from "@/lib/data";

const TABS = [
  { href: "/tokenomics/v2", label: "Overview", active: true },
  { href: "/tokenomics/margins", label: "Margin Calculator" },
  { href: "/tokenomics/tco", label: "Cluster TCO" },
  { href: "/tokenomics/waterfall", label: "Waterfall" },
  { href: "/tokenomics/hardware", label: "Hardware" },
  { href: "/tokenomics/deep-dive", label: "Deep Dive" },
  { href: "/tokenomics/sources", label: "Sources" },
];

interface Props {
  tokenModels: TokenPriceModel[];
  llmflationIndex?: number;
  gpuPricing: { summaries: GPUSummary[]; source: string; fetchedAt: string; history: Record<string, GPUSummary[]> };
  gpuThroughput: Record<string, GPUThroughput>;
  lpxCostAdder: number;
  commentary: unknown;
  ornnUtilization?: OrnnUtilizationHistory | null;
  ornnOCPI?: OrnnOCPIPrices | null;
}

const SPOT_TCO_MULTIPLIER = 1.25;

export default function DashboardV2({
  tokenModels,
  llmflationIndex,
  gpuPricing,
  gpuThroughput,
  lpxCostAdder,
  commentary,
  ornnUtilization,
  ornnOCPI,
}: Props) {

  // Hydration guard — charts render blank in static export, need client render
  const [mounted, setMounted] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  useEffect(() => setMounted(true), []);

  // Derived data
  const sorted = [...tokenModels].sort((a, b) => b.outputPerMillion - a.outputPerMillion);
  const cheapest = tokenModels.length ? tokenModels.reduce((min, m) => m.outputPerMillion < min.outputPerMillion ? m : min) : null;
  const priciest = sorted[0] || null;
  const spread = cheapest && priciest && cheapest.outputPerMillion > 0 ? Math.round(priciest.outputPerMillion / cheapest.outputPerMillion) : 0;

  const gpusWithData = gpuPricing.summaries.filter(g => (g.spot.median || g.onDemand.median) && g.gpuModel.startsWith("nvidia-"));

  // Margin highlights
  const marginHighlights = gpusWithData.map(gpu => {
    const tp = gpuThroughput[gpu.gpuModel];
    const llama = tp?.profiles?.["llama-70b"];
    const tokGpu = llama?.gpuOnly;
    const rawCostHr = gpu.spot.median || gpu.onDemand.median || 0;
    const costHr = rawCostHr * SPOT_TCO_MULTIPLIER;
    if (!tokGpu || rawCostHr === 0) return null;
    const costPerM = costPerMillionFromGPU(costHr, tokGpu);

    const historyDates = Object.keys(gpuPricing.history).sort();
    let dayChange = 0;
    if (historyDates.length >= 2) {
      const prevGpu = gpuPricing.history[historyDates[historyDates.length - 2]]?.find((g: GPUSummary) => g.gpuModel === gpu.gpuModel);
      if (prevGpu?.spot.median && rawCostHr) dayChange = ((rawCostHr - prevGpu.spot.median) / prevGpu.spot.median) * 100;
    }

    return {
      name: GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel,
      gpuModel: gpu.gpuModel,
      rawCostHr, costHr, costPerM: Math.round(costPerM * 100) / 100,
      marginHigh: Math.round(inferenceMargin(6, costPerM)),
      marginPremium: Math.round(inferenceMargin(45, costPerM)),
      availPct: gpu.availabilityPct,
      totalFree: gpu.totalGpusAvailable,
      totalGpus: gpu.totalGpusAvailable + gpu.totalGpusRented,
      dayChange,
    };
  }).filter(Boolean) as any[];

  // Utilization chart data
  const utilColors: Record<string, string> = { h100: "#A855F7", h200: "#00D4FF", b200: "#FF4444", a100: "#76B900" };
  const utilLabels: Record<string, string> = { h100: "H100", h200: "H200", b200: "B200", a100: "A100" };

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      {/* Sticky nav */}
      <div className="sticky top-0 z-50 px-6 pt-3 pb-0 border-b border-bep-border" style={{ background: "#050505ee", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center justify-between mb-2">
          <Link href="/tokenomics/v2" className="no-underline flex items-center gap-2.5">
            <div className="relative w-7 h-7 flex-shrink-0">
              <img src="/bep-icon.png" alt="BEP Research" width={28} height={28} style={{ filter: "brightness(1.2)", borderRadius: 4 }} />
            </div>
            <span className="font-sans text-[17px] font-extrabold tracking-tight text-bep-white">The Stack</span>
            <span className="text-[9px] text-bep-muted font-mono tracking-widest">BEP RESEARCH</span>
          </Link>
          <div className="text-[10px] font-mono text-bep-dim">by Ben Pouladian</div>
        </div>
        <div className="flex gap-0 overflow-x-auto -mb-px">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className="no-underline">
              <div className="px-2.5 py-2 text-[11px] font-mono whitespace-nowrap transition-colors"
                style={{ color: tab.active ? "#f0f0f0" : "#666", fontWeight: tab.active ? 600 : 400,
                  borderBottom: tab.active ? "2px solid #76B900" : "2px solid transparent" }}>
                {tab.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="px-6 py-4 max-w-[920px]">

        {/* ═══ MARKET BRIEF ═══ */}
        <div className="text-[13px] text-bep-dim leading-relaxed mb-4">
          The unit economics of AI inference — from silicon to API. Updated daily.
        </div>
        <MarketBrief data={commentary as never} />

        {/* ═══ KEY METRICS — above the fold ═══ */}
        <div className="mb-5">
          <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider mb-2">Today&apos;s Numbers</div>
          <div className="grid grid-cols-6 gap-1.5">
            <Metric label="LLMflation" value={llmflationIndex ? llmflationIndex.toFixed(1) : "—"} sub="Base 100 = GPT-4" color="#76B900" />
            <Metric label="Token Floor" value={cheapest ? `$${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M` : "—"} sub={cheapest?.model || ""} color="#FF4444" />
            <Metric label="Spread" value={spread ? `${spread}x` : "—"} sub="Floor to ceiling" color="#00D4FF" />
            {marginHighlights.slice(0, 3).map((m: any) => (
              <Metric key={m.gpuModel} label={m.name}
                value={`$${m.rawCostHr.toFixed(2)}/hr`}
                sub={`${m.availPct}% avail · ${m.dayChange !== 0 ? (m.dayChange > 0 ? "▲" : "▼") + Math.abs(m.dayChange).toFixed(1) + "%" : "flat"}`}
                color={m.availPct < 20 ? "#FF4444" : m.availPct < 30 ? "#FFB800" : "#00D4FF"} />
            ))}
          </div>
        </div>

        {/* ═══ GPU ECONOMICS ═══ */}
        <Section title="GPU Inference Economics" subtitle="TCO-adjusted margins on Llama 70B. Who profits, who bleeds.">
          {/* Compact margin table */}
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden mb-3">
            <div className="grid font-mono text-[9px] text-bep-muted uppercase tracking-wider px-3 py-2 border-b border-bep-border"
              style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr 0.7fr 0.7fr 0.7fr 0.5fr" }}>
              <span>GPU</span><span className="text-right">Spot</span><span className="text-right">TCO</span>
              <span className="text-right">Cost/M</span>
              <span className="text-right" style={{ color: "#FFB800" }}>@$6</span>
              <span className="text-right" style={{ color: "#76B900" }}>@$45</span>
              <span className="text-right">Avail</span>
            </div>
            {marginHighlights.map((m: any, i: number) => (
              <div key={m.gpuModel} className="grid px-3 py-1.5 text-[11px] border-b border-bep-border last:border-0"
                style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr 0.7fr 0.7fr 0.7fr 0.5fr", background: i % 2 ? "#0d0d0d" : "transparent" }}>
                <span className="text-bep-white font-medium font-mono">{m.name}</span>
                <span className="text-right font-mono text-bep-dim">${m.rawCostHr.toFixed(2)}</span>
                <span className="text-right font-mono text-bep-amber">${m.costHr.toFixed(2)}</span>
                <span className="text-right font-mono text-bep-dim">${m.costPerM}</span>
                <span className="text-right font-mono font-semibold" style={{ color: m.marginHigh > 0 ? "#76B900" : "#FF4444" }}>{m.marginHigh}%</span>
                <span className="text-right font-mono font-semibold text-bep-green">{m.marginPremium}%</span>
                <span className="text-right font-mono" style={{ color: m.availPct < 20 ? "#FF4444" : m.availPct < 30 ? "#FFB800" : "#76B900" }}>{m.availPct}%</span>
              </div>
            ))}
          </div>

          {/* OCPI 6-month price chart — single full-width */}
          {mounted && (() => {
            const ocpiHistory = ornnOCPI?.history || {};
            const ocpiKeys = Object.keys(ocpiHistory).filter(k => ocpiHistory[k]?.length > 0);
            if (ocpiKeys.length === 0) return null;

            const refKey = ocpiKeys[0];
            const maxLen = ocpiHistory[refKey].length;
            const step = maxLen > 60 ? 3 : maxLen > 30 ? 2 : 1;
            const chartData: Record<string, unknown>[] = [];
            for (let i = 0; i < maxLen; i += step) {
              const row: Record<string, unknown> = {
                date: new Date(ocpiHistory[refKey][i].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              };
              for (const k of ocpiKeys) {
                if (ocpiHistory[k][i]) row[utilLabels[k] || k] = ocpiHistory[k][i].price;
              }
              chartData.push(row);
            }

            const ocpiFooter = ornnOCPI?.latest ? (
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(ornnOCPI.latest).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <span className="text-[12px] font-bold font-mono text-bep-cyan">${v.price}/hr</span>
                    <span className="text-[8px] font-mono text-bep-dim ml-1">{utilLabels[k]} · {v.volatility}% vol</span>
                  </div>
                ))}
              </div>
            ) : undefined;

            return (
              <div className="mb-3">
                <ExpandableChart
                  title="OCPI Spot Index — 6 Month (trade-based $/hr)"
                  attribution={{ label: "Ornn AI", href: "https://www.ornn.com" }}
                  compactHeight={160}
                  expandedHeight={500}
                  footer={ocpiFooter}
                >
                  {(height) => (
                    <ResponsiveContainer width="100%" height={height}>
                      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                        <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 7 }} interval={Math.floor(chartData.length / 7)} />
                        <YAxis tick={{ fill: "#666", fontSize: 8 }} tickFormatter={(v: number) => `$${v}`} />
                        <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 9, fontFamily: "monospace" }}
                          formatter={(v) => [`$${Number(v).toFixed(2)}/hr`, ""]} />
                        {ocpiKeys.map(k => <Line key={k} type="monotone" dataKey={utilLabels[k] || k} stroke={utilColors[k]} strokeWidth={2} dot={false} connectNulls />)}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </ExpandableChart>
              </div>
            );
          })()}

          {/* GPU Utilization Trend — 6 months */}
          {mounted && ornnUtilization && Object.keys(ornnUtilization.gpus).length > 0 && (() => {
            const keys = Object.keys(ornnUtilization.gpus).filter(k => ornnUtilization.gpus[k]?.length > 0);
            const refData = ornnUtilization.gpus[keys[0]];
            const step = refData.length > 60 ? 3 : refData.length > 30 ? 2 : 1;
            const utilData: Record<string, unknown>[] = [];
            for (let i = 0; i < refData.length; i += step) {
              const row: Record<string, unknown> = {
                date: new Date(refData[i].date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              };
              for (const k of keys) {
                if (ornnUtilization.gpus[k][i]) row[utilLabels[k] || k] = ornnUtilization.gpus[k][i].utilization;
              }
              utilData.push(row);
            }

            const latestUtil: Record<string, number> = {};
            for (const k of keys) {
              const arr = ornnUtilization.gpus[k];
              latestUtil[k] = arr[arr.length - 1]?.utilization || 0;
            }

            const utilFooter = (
              <div className="grid grid-cols-4 gap-1.5">
                {keys.map(k => (
                  <div key={k} className="text-center">
                    <span className="text-[13px] font-bold font-mono" style={{ color: utilColors[k] }}>{latestUtil[k]?.toFixed(1)}%</span>
                    <span className="text-[8px] font-mono text-bep-dim ml-1">{utilLabels[k]}</span>
                  </div>
                ))}
              </div>
            );

            return (
              <ExpandableChart
                title="GPU Compute Demand — 6 Month Utilization"
                attribution={{ label: "Ornn AI OCPI", href: "https://www.ornn.com" }}
                compactHeight={160}
                expandedHeight={500}
                footer={utilFooter}
              >
                {(height) => (
                  <ResponsiveContainer width="100%" height={height}>
                    <LineChart data={utilData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 7 }} interval={Math.floor(utilData.length / 7)} />
                      <YAxis tick={{ fill: "#666", fontSize: 8 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 9, fontFamily: "monospace" }}
                        formatter={(v) => [`${Number(v).toFixed(1)}%`, ""]} />
                      <ReferenceLine y={75} stroke="#FFB80030" strokeDasharray="3 3" />
                      {keys.map(k => <Line key={k} type="monotone" dataKey={utilLabels[k] || k} stroke={utilColors[k]} strokeWidth={2} dot={false} connectNulls />)}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </ExpandableChart>
            );
          })()}

          <div className="flex gap-3 mt-1.5 text-[9px] font-mono text-bep-muted justify-center">
            <span><span className="text-[#A855F7]">●</span> H100</span>
            <span><span className="text-[#00D4FF]">●</span> H200</span>
            <span><span className="text-[#FF4444]">●</span> B200</span>
            <span><span className="text-[#76B900]">●</span> A100</span>
          </div>
        </Section>

        {/* ═══ CONNECTOR ═══ */}
        <div className="flex items-center gap-3 my-1 px-1">
          <div className="h-px flex-1 bg-bep-border" />
          <span className="text-[10px] font-mono text-bep-muted whitespace-nowrap">GPU costs → token floor price ↓</span>
          <div className="h-px flex-1 bg-bep-border" />
        </div>

        {/* ═══ TOKEN PRICING ═══ */}
        <Section title="Token Pricing" subtitle={`${tokenModels.length} frontier models. ${spread}x spread between floor and ceiling.`}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Metric label="Floor" value={cheapest ? `$${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M` : "—"} sub={cheapest?.model || ""} color="#FF4444" />
            <Metric label="Ceiling" value={priciest ? `$${priciest.outputPerMillion}/M` : "—"} sub={priciest?.model || ""} color="#A855F7" />
            <Metric label="Spread" value={spread ? `${spread}x` : "—"} sub="Bifurcation, not convergence" color="#00D4FF" />
          </div>
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            <div className="grid font-mono text-[9px] text-bep-muted uppercase tracking-wider px-3 py-1.5 border-b border-bep-border"
              style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr" }}>
              <span>Model</span><span>Provider</span><span className="text-right">In $/M</span><span className="text-right">Out $/M</span>
            </div>
            {(() => {
              const sortedModels = [...tokenModels].sort((a, b) => a.outputPerMillion - b.outputPerMillion);
              const displayModels = showAllModels ? sortedModels : sortedModels.slice(0, 8);
              return displayModels.map((p, i) => (
                <div key={p.model} className="grid px-3 py-1 text-[11px] border-b border-bep-border last:border-0"
                  style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr", background: i % 2 ? "#0d0d0d" : "transparent" }}>
                  <span className="text-bep-white font-medium truncate">{p.model}</span>
                  <span style={{ color: PROVIDER_COLORS[p.provider] || "#666" }}>{p.provider}</span>
                  <span className="text-right text-bep-dim font-mono">${p.inputPerMillion < 1 ? p.inputPerMillion.toFixed(2) : p.inputPerMillion}</span>
                  <span className="text-right text-bep-white font-mono font-semibold">${p.outputPerMillion < 1 ? p.outputPerMillion.toFixed(2) : p.outputPerMillion}</span>
                </div>
              ));
            })()}
            {!showAllModels && tokenModels.length > 8 && (
              <button onClick={() => setShowAllModels(true)}
                className="w-full py-1.5 text-[10px] font-mono text-bep-muted hover:text-bep-green transition-colors border-t border-bep-border">
                Show all {tokenModels.length} models ↓
              </button>
            )}
          </div>
          <div className="text-center mt-1.5">
            <Link href="/tokenomics/margins" className="text-[10px] font-mono text-bep-muted hover:text-bep-green no-underline transition-colors">
              Explore margins by model →
            </Link>
          </div>
        </Section>

        {/* ═══ THESIS + CTA ═══ */}
        <div className="mt-5 bg-bep-card border border-[#76B90030] rounded-md p-4">
          <div className="text-[10px] font-mono text-bep-green uppercase tracking-wider mb-1">What the Data Says</div>
          <div className="text-[12px] text-bep-dim leading-relaxed mb-3">
            GPU costs set the production floor. API pricing sets the revenue ceiling. The gap between them is the entire game.
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            {[
              { name: "Token Explosion", link: "https://bepresearch.substack.com/p/the-token-explosion-why-gtc-2026", desc: "Cheaper tokens don't reduce demand — Jevons Paradox." },
              { name: "Memory Wars", link: "https://bepresearch.substack.com/p/micron-just-proved-the-memory-thesis", desc: "HBM bandwidth is the binding constraint. Memory cost rises to 35%." },
              { name: "NeoCloud Hypothesis", link: "https://bepresearch.substack.com/p/the-neocloud-hypothesis", desc: "CoreWeave, Nebius, Oracle deploy NVIDIA silicon first." },
            ].map((t) => (
              <a key={t.name} href={t.link} target="_blank" rel="noopener noreferrer" className="no-underline">
                <div className="text-bep-white font-semibold mb-0.5 hover:text-bep-green transition-colors">{t.name}</div>
                <div className="text-bep-dim leading-relaxed">{t.desc}</div>
              </a>
            ))}
          </div>
        </div>

        <div className="mt-3 bg-[#76B90008] border border-[#76B90025] rounded-md p-3 text-center">
          <div className="text-[12px] text-bep-white font-semibold mb-1">Premium subscribers get daily briefs, live calculators, and full data access.</div>
          <div className="flex gap-3 justify-center mt-1.5">
            <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-mono px-4 py-1.5 rounded bg-bep-green text-[#050505] font-bold no-underline hover:opacity-90 transition-opacity">
              Subscribe
            </a>
            <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-mono px-4 py-1.5 rounded border border-bep-border text-bep-dim no-underline hover:text-bep-white transition-colors">
              Read on Substack
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 pt-3 border-t border-bep-border">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono" style={{ color: "rgba(102,102,102,0.3)", letterSpacing: 2 }}>BEP RESEARCH &copy; 2026 · BY BEN POULADIAN</span>
            <span className="text-[10px] font-mono text-bep-dim">Updated daily 6AM UTC</span>
          </div>
          <div className="text-[9px] font-mono text-bep-dim">
            GPU utilization data powered by{" "}
            <a href="https://www.ornn.com" target="_blank" rel="noopener noreferrer" className="text-bep-cyan hover:underline no-underline">Ornn AI (OCPI)</a>
            {" "}· Pricing from GetDeploying + Vast.ai · Token pricing from OpenRouter
          </div>
        </div>
      </div>
    </div>
  );
}
