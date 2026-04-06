"use client";

import Link from "next/link";
import MarketBrief from "./MarketBrief";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import { GPU_DISPLAY_NAMES, PROVIDER_COLORS, costPerMillionFromGPU, inferenceMargin } from "@/lib/calculations";
import type {
  TokenPriceModel,
  GPUSummary,
  GPUThroughput,
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
}

const SPOT_TCO_MULTIPLIER = 1.25;

export default function DashboardV2({
  tokenModels,
  llmflationIndex,
  gpuPricing,
  gpuThroughput,
  lpxCostAdder,
  commentary,
}: Props) {

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
    const tokLpx = llama?.withLPX;
    const rawCostHr = gpu.spot.median || gpu.onDemand.median || 0;
    const costHr = rawCostHr * SPOT_TCO_MULTIPLIER;
    if (!tokGpu || rawCostHr === 0) return null;
    const costPerM = costPerMillionFromGPU(costHr, tokGpu);
    const costPerMLpx = tokLpx ? costPerMillionFromGPU(costHr + lpxCostAdder, tokLpx) : null;

    // Day-over-day
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
      costPerMLpx: costPerMLpx ? Math.round(costPerMLpx * 100) / 100 : null,
      marginHigh: Math.round(inferenceMargin(6, costPerM)),
      marginPremium: Math.round(inferenceMargin(45, costPerM)),
      marginPremiumLpx: costPerMLpx ? Math.round(inferenceMargin(45, costPerMLpx)) : null,
      availPct: gpu.availabilityPct,
      totalFree: gpu.totalGpusAvailable,
      totalGpus: gpu.totalGpusAvailable + gpu.totalGpusRented,
      dayChange,
      spotMin: gpu.spot.min,
      spotMax: gpu.spot.max,
    };
  }).filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>>[number][];

  // Show all models
  const topModels = sorted;

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
          <div className="text-[10px] font-mono text-bep-dim">
            by Ben Pouladian
          </div>
        </div>
        <div className="flex gap-0 overflow-x-auto -mb-px">
          {TABS.map((tab) => (
            <Link key={tab.href} href={tab.href} className="no-underline">
              <div className="px-2.5 py-2 text-[11px] font-mono whitespace-nowrap transition-colors"
                style={{
                  color: tab.active ? "#f0f0f0" : "#666",
                  fontWeight: tab.active ? 600 : 400,
                  borderBottom: tab.active ? "2px solid #76B900" : "2px solid transparent",
                }}>
                {tab.label}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="px-6 py-5 max-w-[920px]">

        {/* ═══ HERO: What this is ═══ */}
        <div className="mb-5">
          <div className="text-[13px] text-bep-dim leading-relaxed">
            The unit economics of AI inference — from silicon to API. Updated daily.
          </div>
        </div>

        {/* ═══ 1. MARKET BRIEF ═══ */}
        <MarketBrief data={commentary as never} />

        {/* ═══ 2. TODAY'S NUMBERS ═══ */}
        <div className="mb-6">
          <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider mb-2">Today&apos;s Numbers</div>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="LLMflation Index" value={llmflationIndex ? llmflationIndex.toFixed(1) : "—"} sub="Token price index (100 = GPT-4 launch)" color="#76B900" />
            <Metric label="Cheapest Token" value={cheapest ? `$${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M` : "—"} sub={cheapest ? `${cheapest.model} output` : ""} color="#FF4444" />
            <Metric label="Price Spread" value={spread ? `${spread}x` : "—"} sub={cheapest && priciest ? `${priciest.model} vs ${cheapest.model}` : "Floor to ceiling"} color="#00D4FF" />
          </div>
        </div>

        {/* ═══ 3. GPU ECONOMICS — The cost side ═══ */}
        <Section title="Step 1: The Cost to Produce a Token" subtitle="Rent a GPU, run inference, calculate cost per million output tokens.">

          {/* GPU cards row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            {(marginHighlights as any[]).slice(0, 3).map((m: any) => (
              <div key={m.gpuModel} className="bg-bep-card border border-bep-border rounded-md p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-bold font-mono text-bep-white">{m.name}</span>
                  {m.dayChange !== 0 && (
                    <span className="text-[10px] font-mono font-semibold" style={{ color: m.dayChange > 0 ? "#FF4444" : "#76B900" }}>
                      {m.dayChange > 0 ? "▲" : "▼"}{Math.abs(m.dayChange).toFixed(1)}%
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold font-mono text-bep-cyan">${m.rawCostHr.toFixed(2)}<span className="text-[10px] text-bep-dim">/hr spot</span></div>
                <div className="grid grid-cols-2 gap-x-2 mt-2 text-[10px]">
                  <div className="flex justify-between"><span className="text-bep-muted">TCO</span><span className="font-mono text-bep-amber">${m.costHr.toFixed(2)}/hr</span></div>
                  <div className="flex justify-between"><span className="text-bep-muted">Cost/M tokens</span><span className="font-mono text-bep-white font-semibold">${m.costPerM}</span></div>
                  <div className="flex justify-between"><span className="text-bep-muted">Available</span>
                    <span className="font-mono font-semibold" style={{ color: m.availPct < 20 ? "#FF4444" : m.availPct < 30 ? "#FFB800" : "#76B900" }}>{m.availPct}%</span>
                  </div>
                  <div className="flex justify-between"><span className="text-bep-muted">Supply</span><span className="font-mono text-bep-dim">{m.totalFree}/{m.totalGpus}</span></div>
                </div>
                <div className="mt-2 h-1 rounded-full bg-bep-bg overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(m.availPct, 100)}%`, background: m.availPct < 20 ? "#FF4444" : m.availPct < 30 ? "#FFB800" : "#76B900" }} />
                </div>
              </div>
            ))}
          </div>

          {/* Margin table */}
          <div className="text-[10px] text-bep-dim mb-1">Inference provider margins selling Llama 70B output tokens at two price tiers.</div>
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden mb-3">
            <div className="grid font-mono text-[9px] text-bep-muted uppercase tracking-wider px-3 py-2 border-b border-bep-border"
              style={{ gridTemplateColumns: "1fr 0.6fr 0.6fr 0.7fr 0.7fr 0.7fr 0.5fr" }}>
              <span>GPU</span><span className="text-right">Spot</span><span className="text-right">TCO</span>
              <span className="text-right">Cost/M</span>
              <span className="text-right" title="Profit margin if selling tokens at $6/M (standard reasoning chatbot tier)" style={{ color: "#FFB800" }}>Margin @$6</span>
              <span className="text-right" title="Profit margin if selling tokens at $45/M (premium deep-research tier)" style={{ color: "#76B900" }}>Margin @$45</span>
              <span className="text-right">Avail</span>
            </div>
            {(marginHighlights as any[]).map((m: any, i: number) => (
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

          {/* Price + Availability mini charts side by side */}
          {Object.keys(gpuPricing.history).length >= 2 && (() => {
            const dates = Object.keys(gpuPricing.history).sort();
            const gpuModels = ["nvidia-h100", "nvidia-h200", "nvidia-b200"];
            const colors: Record<string, string> = { "nvidia-h100": "#A855F7", "nvidia-h200": "#00D4FF", "nvidia-b200": "#FF4444" };

            const priceData = dates.map(date => {
              const row: Record<string, number | string | null> = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
              for (const gm of gpuModels) {
                const e = gpuPricing.history[date]?.find((g: GPUSummary) => g.gpuModel === gm);
                row[GPU_DISPLAY_NAMES[gm]] = e?.spot.median || null;
              }
              return row;
            });
            const availData = dates.map(date => {
              const row: Record<string, number | string | null> = { date: new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
              for (const gm of gpuModels) {
                const e = gpuPricing.history[date]?.find((g: GPUSummary) => g.gpuModel === gm);
                row[GPU_DISPLAY_NAMES[gm]] = e?.availabilityPct ?? null;
              }
              return row;
            });

            return (
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-bep-card border border-bep-border rounded-md p-2.5">
                  <div className="text-[9px] font-mono text-bep-muted uppercase tracking-wider mb-1">Spot $/hr</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={priceData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 8 }} />
                      <YAxis tick={{ fill: "#666", fontSize: 8 }} tickFormatter={(v: number) => `$${v}`} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 9, fontFamily: "monospace" }}
                        formatter={(v) => [`$${Number(v).toFixed(2)}`, ""]} />
                      {gpuModels.map(gm => <Line key={gm} type="monotone" dataKey={GPU_DISPLAY_NAMES[gm]} stroke={colors[gm]} strokeWidth={2} dot={{ r: 2 }} connectNulls />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="bg-bep-card border border-bep-border rounded-md p-2.5">
                  <div className="text-[9px] font-mono text-bep-muted uppercase tracking-wider mb-1">Availability %</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={availData} margin={{ top: 2, right: 2, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 8 }} />
                      <YAxis tick={{ fill: "#666", fontSize: 8 }} tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
                      <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 9, fontFamily: "monospace" }}
                        formatter={(v) => [`${v}%`, ""]} />
                      <ReferenceLine y={25} stroke="#FFB80030" strokeDasharray="3 3" />
                      {gpuModels.map(gm => <Line key={gm} type="monotone" dataKey={GPU_DISPLAY_NAMES[gm]} stroke={colors[gm]} strokeWidth={2} dot={{ r: 2 }} connectNulls />)}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })()}

          <div className="flex gap-3 mt-1.5 text-[9px] font-mono text-bep-muted justify-center">
            <span><span className="text-[#A855F7]">●</span> H100</span>
            <span><span className="text-[#00D4FF]">●</span> H200</span>
            <span><span className="text-[#FF4444]">●</span> B200</span>
          </div>
        </Section>

        {/* ═══ CONNECTOR ═══ */}
        <div className="flex items-center gap-3 my-1 px-1">
          <div className="h-px flex-1 bg-bep-border" />
          <span className="text-[10px] font-mono text-bep-muted whitespace-nowrap">These GPU costs become the floor for API token prices ↓</span>
          <div className="h-px flex-1 bg-bep-border" />
        </div>

        {/* ═══ 4. TOKEN PRICING — The sell side ═══ */}
        <Section title="Step 2: What Tokens Sell For" subtitle={`${tokenModels.length} frontier models tracked. The spread tells the story.`}>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Metric label="Floor" value={cheapest ? `$${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M` : "—"} sub={cheapest?.model || ""} color="#FF4444" />
            <Metric label="Ceiling" value={priciest ? `$${priciest.outputPerMillion}/M` : "—"} sub={priciest?.model || ""} color="#A855F7" />
            <Metric label="Spread" value={spread ? `${spread}x` : "—"} sub="Floor to ceiling — bifurcation, not convergence" color="#00D4FF" />
          </div>
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            <div className="grid font-mono text-[9px] text-bep-muted uppercase tracking-wider px-3 py-1.5 border-b border-bep-border"
              style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr" }}>
              <span>Model</span><span>Provider</span><span className="text-right">In $/M</span><span className="text-right">Out $/M</span>
            </div>
            {/* Cheapest first — volume models drive GPU demand, expensive models show the ceiling */}
            {[...tokenModels].sort((a, b) => a.outputPerMillion - b.outputPerMillion).map((p, i) => (
              <div key={p.model} className="grid px-3 py-1 text-[11px] border-b border-bep-border last:border-0"
                style={{ gridTemplateColumns: "2fr 1fr 0.7fr 0.7fr", background: i % 2 ? "#0d0d0d" : "transparent" }}>
                <span className="text-bep-white font-medium truncate">{p.model}</span>
                <span style={{ color: PROVIDER_COLORS[p.provider] || "#666" }}>{p.provider}</span>
                <span className="text-right text-bep-dim font-mono">${p.inputPerMillion < 1 ? p.inputPerMillion.toFixed(2) : p.inputPerMillion}</span>
                <span className="text-right text-bep-white font-mono font-semibold">${p.outputPerMillion < 1 ? p.outputPerMillion.toFixed(2) : p.outputPerMillion}</span>
              </div>
            ))}
          </div>
          <div className="text-center mt-1.5">
            <Link href="/tokenomics/margins" className="text-[10px] font-mono text-bep-muted hover:text-bep-green no-underline transition-colors">
              Explore margins by model →
            </Link>
          </div>
        </Section>

        {/* ═══ WHAT THE DATA SAYS ═══ */}
        <div className="mt-6 bg-bep-card border border-[#76B90030] rounded-md p-4">
          <div className="text-[10px] font-mono text-bep-green uppercase tracking-wider mb-1">What the Data Says</div>
          <div className="text-[12px] text-bep-dim leading-relaxed mb-3">
            GPU costs set the production floor. API pricing sets the revenue ceiling. The gap between them — and who captures it — is the entire game. Three theses explain what happens next:
          </div>
          <div className="grid grid-cols-3 gap-3 text-[11px]">
            {[
              { name: "Token Explosion", link: "https://bepresearch.substack.com", desc: "Cheaper tokens don't reduce demand — Jevons Paradox. 10,000x inference scaling." },
              { name: "Memory Wars", link: "https://bepresearch.substack.com", desc: "HBM bandwidth is the binding constraint. Memory's share of token cost rises to 35%." },
              { name: "NeoCloud Hypothesis", link: "https://bepresearch.substack.com", desc: "CoreWeave, Nebius, Oracle deploy NVIDIA silicon first. No competing chips." },
            ].map((t) => (
              <a key={t.name} href={t.link} target="_blank" rel="noopener noreferrer" className="no-underline">
                <div className="text-bep-white font-semibold mb-1 hover:text-bep-green transition-colors">{t.name}</div>
                <div className="text-bep-dim leading-relaxed">{t.desc}</div>
              </a>
            ))}
          </div>
        </div>

        {/* ═══ CTA ═══ */}
        <div className="mt-4 bg-[#76B90008] border border-[#76B90025] rounded-md p-4 text-center">
          <div className="text-[13px] text-bep-white font-semibold mb-1">Premium subscribers get daily AI-generated market briefs, live calculators, and full data access.</div>
          <div className="flex gap-3 justify-center mt-2">
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
        <div className="mt-6 pt-4 border-t border-bep-border">
          <div className="flex items-center justify-between mb-2">
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
