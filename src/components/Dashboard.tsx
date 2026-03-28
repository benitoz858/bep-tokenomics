"use client";

import { useState } from "react";
import SignalFeed from "./SignalFeed";
import ActionableInsights from "./ActionableInsights";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { GPU_DISPLAY_NAMES, PROVIDER_COLORS, costPerMillionFromGPU, inferenceMargin } from "@/lib/calculations";
import type {
  TokenPriceModel,
  NVIDIATier,
  RevenuePerWattPlatform,
  CostStackComponent,
  GPUSummary,
  GPUThroughput,
  ModelInfo,
  TierHardware,
  GPUHardwareSpecsData,
} from "@/lib/data";

interface DashboardProps {
  tokenModels: TokenPriceModel[];
  tokenHistory: Record<string, Array<{ modelId: string; inputPerMillion: number; outputPerMillion: number }>>;
  llmflationIndex?: number;
  nvidiaTiers: NVIDIATier[];
  revenuePerWatt: { platforms: RevenuePerWattPlatform[]; derivation: { title: string; steps: string[] } };
  costStack: { components: CostStackComponent[]; insight: string };
  gpuPricing: { summaries: GPUSummary[]; source: string; fetchedAt: string; history: Record<string, GPUSummary[]> };
  gpuThroughput: Record<string, GPUThroughput>;
  throughputModels: ModelInfo[];
  tierHardware: Record<string, TierHardware>;
  lpxCostAdder: number;
  tcoProviders: never[];
  inferenceMarginData: unknown;
  gpuHardwareSpecs: GPUHardwareSpecsData | null;
}

export default function Dashboard({
  tokenModels,
  llmflationIndex,
  gpuPricing,
  tokenHistory,
  gpuThroughput,
  throughputModels,
  tierHardware,
  lpxCostAdder,
}: DashboardProps) {

  // ── Compute derived data for overview ──
  const sorted = [...tokenModels].sort((a, b) => b.outputPerMillion - a.outputPerMillion);
  const cheapest = tokenModels.length ? tokenModels.reduce((min, m) => m.outputPerMillion < min.outputPerMillion ? m : min) : null;
  const priciest = sorted[0] || null;
  const spread = cheapest && priciest && cheapest.outputPerMillion > 0 ? Math.round(priciest.outputPerMillion / cheapest.outputPerMillion) : 0;

  // GPU spot overview
  const gpusWithData = gpuPricing.summaries.filter(g => (g.spot.median || g.onDemand.median) && g.gpuModel.startsWith("nvidia-"));
  const cheapestGpu = gpusWithData.length ? gpusWithData.reduce((min, g) => ((g.spot.median || 99) < (min.spot.median || 99) ? g : min)) : null;

  // Margin highlights
  const marginHighlights = gpusWithData.map(gpu => {
    const tp = gpuThroughput[gpu.gpuModel];
    const llama = tp?.profiles?.["llama-70b"];
    const tokGpu = llama?.gpuOnly;
    const tokLpx = llama?.withLPX;
    const costHr = gpu.spot.median || gpu.onDemand.median || 0;
    if (!tokGpu || costHr === 0) return null;
    const costPerM = costPerMillionFromGPU(costHr, tokGpu);
    const costPerMLpx = tokLpx ? costPerMillionFromGPU(costHr + lpxCostAdder, tokLpx) : null;
    return {
      name: GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel,
      gpuModel: gpu.gpuModel,
      costHr,
      costPerM: Math.round(costPerM * 100) / 100,
      costPerMLpx: costPerMLpx ? Math.round(costPerMLpx * 100) / 100 : null,
      marginHigh: Math.round(inferenceMargin(6, costPerM)),
      marginPremium: Math.round(inferenceMargin(45, costPerM)),
      marginPremiumLpx: costPerMLpx ? Math.round(inferenceMargin(45, costPerMLpx)) : null,
      availPct: gpu.availabilityPct,
      totalGpus: gpu.totalGpusAvailable + gpu.totalGpusRented,
    };
  }).filter(Boolean) as Array<{
    name: string; gpuModel: string; costHr: number; costPerM: number; costPerMLpx: number | null;
    marginHigh: number; marginPremium: number; marginPremiumLpx: number | null;
    availPct: number; totalGpus: number;
  }>;

  // Token pricing top 8 for compact table
  const topModels = sorted.slice(0, 10);

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      {/* Header */}
      <div className="px-6 pt-5 pb-4 border-b border-bep-border">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 flex-shrink-0">
            <img src="/bep-icon.png" alt="BEP Research" width={32} height={32} style={{ filter: "brightness(1.2)", borderRadius: 4 }} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-[20px] font-extrabold tracking-tight">The Stack</span>
              <span className="text-[10px] text-bep-muted font-mono tracking-widest">BEP RESEARCH</span>
            </div>
            <div className="text-[11px] text-bep-dim">
              AI infrastructure unit economics — live data by Ben Pouladian
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-5 max-w-[920px]">

        {/* ═══ SIGNALS + INSIGHTS ═══ */}
        <SignalFeed
          tokenModels={tokenModels}
          gpuSummaries={gpuPricing.summaries}
          llmflationIndex={llmflationIndex}
          fetchedAt={gpuPricing.fetchedAt}
        />
        <ActionableInsights
          tokenModels={tokenModels}
          gpuSummaries={gpuPricing.summaries}
          gpuThroughput={gpuThroughput}
          llmflationIndex={llmflationIndex}
        />

        {/* ═══ HERO METRICS ═══ */}
        <div className="grid grid-cols-5 gap-2 mb-6">
          <Metric label="LLMflation Index" value={llmflationIndex ? llmflationIndex.toFixed(1) : "—"} sub="Base 100 = GPT-4 Mar 2023" color="#76B900" />
          <Metric label="Cheapest Output" value={cheapest ? `$${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M` : "—"} sub={cheapest?.model || ""} color="#FF4444" />
          <Metric label="Premium / Cheap" value={spread ? `${spread}x` : "—"} sub="Price spread" color="#A855F7" />
          <Metric label="Cheapest GPU" value={cheapestGpu ? `$${(cheapestGpu.spot.median || 0).toFixed(2)}/hr` : "—"} sub={cheapestGpu ? GPU_DISPLAY_NAMES[cheapestGpu.gpuModel] || "" : ""} color="#FFB800" />
          <Metric label="Models Tracked" value={`${tokenModels.length}`} sub={`${gpusWithData.length} GPU markets`} color="#00D4FF" />
        </div>

        {/* ═══ GPU ECONOMICS AT A GLANCE ═══ */}
        <Section title="GPU Economics at a Glance" subtitle="Spot price, token production cost, and margin at each tier — all from live data. Green = profitable, red = losing money.">
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            <div className="grid font-mono text-[10px] text-bep-muted uppercase tracking-wider px-3.5 py-2.5 border-b border-bep-border"
              style={{ gridTemplateColumns: "1fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.6fr" }}>
              <span>GPU</span>
              <span className="text-right">Spot $/hr</span>
              <span className="text-right">Cost/M tok</span>
              <span className="text-right" style={{ color: "#FFB800" }}>High ($6)</span>
              <span className="text-right" style={{ color: "#76B900" }}>Premium ($45)</span>
              <span className="text-right" style={{ color: "#76B900" }}>+LPX ($45)</span>
              <span className="text-right">Avail</span>
            </div>
            {marginHighlights.map((m, i) => (
              <div key={m.gpuModel} className="grid px-3.5 py-2 text-xs border-b border-bep-border last:border-0"
                style={{
                  gridTemplateColumns: "1fr 0.7fr 0.7fr 0.8fr 0.8fr 0.8fr 0.6fr",
                  background: i % 2 === 0 ? "transparent" : "#0d0d0d",
                }}>
                <span className="text-bep-white font-medium font-mono">{m.name}</span>
                <span className="text-right font-mono text-bep-amber">${m.costHr.toFixed(2)}</span>
                <span className="text-right font-mono text-bep-dim">${m.costPerM}</span>
                <span className="text-right font-mono font-semibold" style={{ color: m.marginHigh > 0 ? "#76B900" : "#FF4444" }}>
                  {m.marginHigh}%
                </span>
                <span className="text-right font-mono font-semibold text-bep-green">{m.marginPremium}%</span>
                <span className="text-right font-mono font-semibold" style={{ color: m.marginPremiumLpx ? "#76B900" : "#333" }}>
                  {m.marginPremiumLpx ? `${m.marginPremiumLpx}%` : "—"}
                </span>
                <span className="text-right font-mono" style={{ color: m.availPct < 20 ? "#FF4444" : m.availPct < 40 ? "#FFB800" : "#76B900" }}>
                  {m.availPct > 0 ? `${m.availPct}%` : "—"}
                </span>
              </div>
            ))}
          </div>
          <div className="text-[10px] font-mono text-bep-dim mt-2">
            Serving Llama 3.3 70B. Cost/M = token production cost. Margins at Jensen&apos;s tier pricing. LPX adds ~$2.50/hr but 3-5x throughput.
          </div>
        </Section>

        {/* ═══ MARGIN CHART ═══ */}
        <Section title="Where the Margin Lives" subtitle="GPU-only margins go negative at High tier for most hardware. LPX decode acceleration is what makes Premium tier profitable across all GPUs.">
          <div className="bg-bep-card border border-bep-border rounded-md p-4">
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={marginHighlights} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[-100, 100]} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                  formatter={(v) => [`${Number(v)}%`, ""]} />
                <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
                <Bar dataKey="marginHigh" name="High tier ($6/M)" fill="#FFB80060" barSize={14} radius={[2, 2, 0, 0]} />
                <Bar dataKey="marginPremium" name="Premium ($45/M)" fill="#76B900" barSize={14} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted justify-center">
              <span><span className="text-bep-amber">■</span> High tier ($6/M) — GPU only</span>
              <span><span className="text-bep-green">■</span> Premium ($45/M) — GPU only</span>
            </div>
          </div>
        </Section>

        {/* ═══ TOKEN PRICING SNAPSHOT ═══ */}
        <Section title="Token Pricing Snapshot" subtitle={`${tokenModels.length} frontier models tracked via OpenRouter. Sorted by output cost.`}>
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            <div className="grid font-mono text-[10px] text-bep-muted uppercase tracking-wider px-3.5 py-2 border-b border-bep-border"
              style={{ gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr" }}>
              <span>Model</span><span>Provider</span><span className="text-right">Input $/M</span><span className="text-right">Output $/M</span>
            </div>
            {topModels.map((p, i) => (
              <div key={p.model} className="grid px-3.5 py-1.5 text-xs border-b border-bep-border last:border-0"
                style={{
                  gridTemplateColumns: "2fr 1fr 0.8fr 0.8fr",
                  background: i % 2 === 0 ? "transparent" : "#0d0d0d",
                }}>
                <span className="text-bep-white font-medium truncate">{p.model}</span>
                <span style={{ color: PROVIDER_COLORS[p.provider] || "#666" }}>{p.provider}</span>
                <span className="text-right text-bep-dim font-mono">${p.inputPerMillion < 1 ? p.inputPerMillion.toFixed(2) : p.inputPerMillion}</span>
                <span className="text-right text-bep-white font-mono font-semibold">${p.outputPerMillion < 1 ? p.outputPerMillion.toFixed(2) : p.outputPerMillion}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* ═══ GPU SPOT MARKET ═══ */}
        <Section title="GPU Spot Market" subtitle="Live availability and pricing from Vast.ai. Red = tight supply.">
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {gpusWithData.slice(0, 3).map((gpu) => {
              const name = GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel;
              const spot = gpu.spot.median;
              return (
                <div key={gpu.gpuModel} className="bg-bep-card border border-bep-border rounded-md p-3">
                  <div className="text-sm font-bold font-mono text-bep-white mb-2">{name}</div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-bep-muted">Spot median</span>
                    <span className="font-mono text-bep-cyan">{spot ? `$${spot.toFixed(2)}/hr` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-bep-muted">Availability</span>
                    <span className="font-mono" style={{ color: gpu.availabilityPct < 20 ? "#FF4444" : gpu.availabilityPct < 40 ? "#FFB800" : "#76B900" }}>
                      {gpu.availabilityPct}%
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-bep-muted">GPUs</span>
                    <span className="font-mono text-bep-dim">{gpu.totalGpusAvailable}/{gpu.totalGpusAvailable + gpu.totalGpusRented}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-bep-border flex items-center justify-between">
          <span className="text-[9px] font-mono" style={{ color: "rgba(102,102,102,0.3)", letterSpacing: 2 }}>
            BEP RESEARCH &copy; 2026
          </span>
          <span className="text-[10px] font-mono text-bep-dim">
            Updated daily 6AM UTC · <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer" className="text-bep-green hover:underline">Substack</a>
          </span>
        </div>
      </div>
    </div>
  );
}
