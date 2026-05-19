"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import Section from "./ui/Section";
import Metric from "./ui/Metric";
import InsightBox from "./ui/InsightBox";
import { blendedTokenCostFromMix, platformTokenMargin, type ModelMixEntry, type BlendedCostBreakdown } from "@/lib/calculations";
import type { TokenPriceModel } from "@/lib/data";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LiveStages {
  h100SpotPerHr: number;
  h100TcoPerHr: number;
  h100CostPerM: number;
  h100TokPerSec: number;
}

interface HistoricalPoint {
  quarter: string;
  date: string;
  basketPerM: number;
  index: number;
}

interface Props {
  data: any;
  liveStages?: LiveStages;
  liveTokenModels?: TokenPriceModel[];
  historicalSeries?: HistoricalPoint[];
}

const MARGIN_COLOR = (pct: number | null) =>
  pct === null ? "#666"
  : pct > 80 ? "#76B900"
  : pct > 50 ? "#00D4FF"
  : pct > 20 ? "#FFB800"
  : pct > 0 ? "#FF6B6B"
  : "#FF4444";

// Confidence → opacity. Verified disclosures get full bars; modeled estimates fade.
const CONFIDENCE_OPACITY: Record<string, number> = {
  high: 1.0,
  medium: 0.75,
  "medium-low": 0.55,
  low: 0.40,
};

// "Verified" = customer pricing is taken from a public pricing page (high confidence) AND
// the token-cost estimate is at least medium confidence. Pure "high+high" is impossible
// because no platform publicly discloses tokens/interaction.
const isVerified = (p: any) =>
  p?.customerPricing?.confidence === "high" &&
  (p?.estimatedModelCost?.confidence === "high" || p?.estimatedModelCost?.confidence === "medium");

const CATEGORY_LABELS: Record<string, string> = {
  "agent-platform": "Agent platforms",
  "productivity-suite": "Productivity suites",
  "developer-tools": "Developer tools",
  "creative-tools": "Creative tools",
  "data-platform": "Data platforms",
  "enterprise-ai": "Enterprise AI",
  "model-provider": "Model providers (direct)",
};

const CATEGORY_COLOR: Record<string, string> = {
  "agent-platform": "#76B900",
  "productivity-suite": "#00D4FF",
  "developer-tools": "#A855F7",
  "creative-tools": "#EC4899",
  "data-platform": "#FFB800",
  "enterprise-ai": "#FF6B35",
  "model-provider": "#5BA9FF",
};

export default function TokenWaterfall({ data, liveStages, liveTokenModels = [], historicalSeries = [] }: Props) {
  // Sensitivity slider: scale every platform's tokens-per-interaction by this factor.
  // Default 1.0 = data file assumptions. User can stress-test up/down 3x.
  const [tokenMultiplier, setTokenMultiplier] = useState(1.0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string | "all">("all");

  if (!data) return null;

  const platforms: any[] = data.platforms || [];
  const summary = data.waterfall_summary || {};
  // Prefer the live-derived historical series (computed from token-pricing/history.json with
  // era-aware flagship picking). Fall back to the synthesized JSON series only if for some
  // reason the server-derived series is empty.
  const historical: Array<{ quarter: string; date?: string; basketPerM?: number; blendedCostPerM?: number; index?: number }> =
    historicalSeries.length > 0
      ? historicalSeries
      : (data.historicalCostBenchmark?.series || []);

  // Live H100 → token production cost; falls back to prior reference values if data unavailable
  const h100Tco = liveStages?.h100TcoPerHr || 3.00;
  const h100CostPerM = liveStages?.h100CostPerM || 8.77;
  const h100TokPerSec = liveStages?.h100TokPerSec || 95;

  const SONNET_PRICE = 15;
  const SALESFORCE_PER_CONV = 2;
  const TOKENS_PER_CONV = 6000;
  const platformPricePerM = (SALESFORCE_PER_CONV / TOKENS_PER_CONV) * 1_000_000;

  // ── Compute LIVE token margins for every platform ──
  const computed = useMemo(() => {
    return platforms.map((p) => {
      const mix: ModelMixEntry[] = (p.modelMix as ModelMixEntry[]) || [];
      const blended: BlendedCostBreakdown = mix.length
        ? blendedTokenCostFromMix(mix, liveTokenModels)
        : { costPerM: 0, details: [], missingModels: [] };

      const tokensRaw = p.estimatedModelCost?.tokensPerInteraction;
      const tokens = tokensRaw !== null && tokensRaw !== undefined
        ? Math.round(tokensRaw * tokenMultiplier)
        : null;
      const interactionsPerUserPerDay = p.estimatedModelCost?.interactionsPerUserPerDay ?? null;

      const margin = platformTokenMargin({
        pricingModel: p.customerPricing.model,
        customerPrice: p.customerPricing.price,
        blendedCostPerM: blended.costPerM,
        tokensPerInteraction: tokens,
        interactionsPerUserPerDay,
        markupRate: p.customerPricing?.markupRate ?? null,
      });

      const customerPrice: number = p.customerPricing.price;
      const profitable = margin.marginPerUnit !== null && margin.marginPerUnit > 0;

      return {
        ...p,
        blended,
        liveCostPerUnit: margin.costPerUnit,
        liveMarginPerUnit: margin.marginPerUnit,
        liveMarginPct: margin.marginPct,
        profitable,
        tokensAdjusted: tokens,
        customerPrice,
      };
    });
  }, [platforms, liveTokenModels, tokenMultiplier]);

  // ── Filtered rows for table/chart ──
  const filtered = useMemo(() => {
    return computed
      .filter((p) => activeCategory === "all" || p.category === activeCategory)
      .filter((p) => !verifiedOnly || isVerified(p));
  }, [computed, verifiedOnly, activeCategory]);

  // ── Hero stats ──
  const computable = computed.filter((p) => p.liveMarginPct !== null);
  const profitableCount = computable.filter((p) => p.profitable).length;
  const topMargin = [...computable].sort((a, b) => (b.liveMarginPct! - a.liveMarginPct!))[0];
  const lowestMargin = [...computable].sort((a, b) => (a.liveMarginPct! - b.liveMarginPct!))[0];

  // ── Margin chart data ──
  const marginData = filtered
    .filter((p) => p.liveMarginPct !== null)
    .sort((a, b) => b.liveMarginPct! - a.liveMarginPct!)
    .map((p) => ({
      name: p.vendor,
      product: p.name,
      margin: Math.round(p.liveMarginPct! * 10) / 10,
      category: p.category,
      verified: isVerified(p),
      opacity: CONFIDENCE_OPACITY[p.estimatedModelCost?.confidence ?? "low"] ?? 0.4,
    }));

  // ── Waterfall stages (live) ──
  const waterfallStages = [
    { stage: "GPU Rental", cost: h100Tco, label: "H100 TCO $/hr (1.25x spot)", color: "#555" },
    { stage: "Token Production", cost: h100CostPerM, label: `$/M tokens — Llama 70B on H100 (${h100TokPerSec} tok/s)`, color: "#FFB800" },
    { stage: "API Sell Price", cost: SONNET_PRICE, label: "Anthropic Sonnet 4.6 output $/M", color: "#00D4FF" },
    { stage: "Platform Price", cost: platformPricePerM, label: `Salesforce $${SALESFORCE_PER_CONV}/conv → $/M equiv (${TOKENS_PER_CONV / 1000}K tokens)`, color: "#76B900" },
  ];

  // ── Historical LLMflation compounding chart — derived from REAL token-pricing history ──
  // Each quarterly point is computed server-side from the closest snapshot in
  // data/token-pricing/history.json using era-aware flagship-picking (so Q1 2024 picks
  // GPT-4 Turbo + Claude 3 Opus, Q2 2025 picks GPT-4.5 at the $150/M peak, etc.). The
  // hypothetical Agentforce margin shows what would have happened if Salesforce had
  // routed their interactions through the LLMflation basket each quarter, holding price
  // constant at $2/conv × 10K tokens. Real Agentforce routing uses cheaper models, so
  // actual margin tracks higher.
  const historicalChart = useMemo(() => {
    const ref = computed.find((p) => p.id === "salesforce-agentforce");
    if (!ref || !historical.length) return [];

    return historical.map((h) => {
      const refTokens = ref.estimatedModelCost?.tokensPerInteraction ?? 10000;
      const basket = h.basketPerM ?? h.blendedCostPerM ?? 0;
      const costPerUnit = (refTokens / 1_000_000) * basket;
      const price = ref.customerPricing.price;
      const marginPct = price > 0 ? ((price - costPerUnit) / price) * 100 : 0;
      return {
        quarter: h.quarter,
        basketPerM: Math.round(basket * 100) / 100,
        index: h.index !== undefined ? Math.round(h.index * 10) / 10 : Math.round((basket / 60) * 100 * 10) / 10,
        agentforceMargin: Math.round(marginPct * 10) / 10,
      };
    });
  }, [computed, historical]);

  return (
    <div>
      {/* Hero metrics — live */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Metric
          label="Platforms tracked"
          value={`${computed.length}`}
          sub={`${profitableCount} token-profitable today`}
          color="#76B900"
        />
        <Metric
          label="Highest token margin"
          value={topMargin?.liveMarginPct !== null && topMargin?.liveMarginPct !== undefined ? `${topMargin.liveMarginPct.toFixed(0)}%` : "—"}
          sub={topMargin ? `${topMargin.vendor} ${topMargin.name}` : ""}
          color="#76B900"
        />
        <Metric
          label="Lowest token margin"
          value={lowestMargin?.liveMarginPct !== null && lowestMargin?.liveMarginPct !== undefined ? `${lowestMargin.liveMarginPct.toFixed(0)}%` : "—"}
          sub={lowestMargin ? `${lowestMargin.vendor} ${lowestMargin.name}` : ""}
          color="#FF6B6B"
        />
        <Metric
          label="GPU → Token"
          value={`$${h100Tco.toFixed(2)} → $${h100CostPerM.toFixed(2)}`}
          sub="H100 TCO/hr → $/M (Llama 70B)"
          color="#FFB800"
        />
      </div>

      {/* Waterfall chart */}
      <Section title="Token Cost Waterfall" subtitle="Follow $1 of GPU compute through the stack. Each layer adds margin. By the time a token reaches an enterprise customer, the markup is 100x+ the hardware cost.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={waterfallStages} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="stage" tick={{ fill: "#f0f0f0", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} scale="log" domain={[1, 500]} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v, _name, props) => [`$${Number(v).toFixed(2)}`, (props?.payload as any)?.label || ""]} />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]} barSize={50}>
                {waterfallStages.map((s, i) => <Cell key={i} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[10px] font-mono text-bep-dim text-center mt-2">
            Log scale. Platform price equivalent assumes ~6K tokens per enterprise interaction.
          </div>
        </div>
      </Section>

      {/* Methodology caveat — make the limits visible */}
      {data.tokenMarginCaveat && (
        <div className="bg-[#FFB80008] border border-[#FFB80030] rounded-md p-3 mb-4 text-[11px] font-mono text-bep-dim leading-relaxed">
          <span className="text-bep-amber font-semibold">What &quot;token margin&quot; means: </span>
          {data.tokenMarginCaveat}
        </div>
      )}

      {/* Controls — sensitivity + verified filter + category */}
      <div className="bg-bep-card border border-bep-border rounded-md p-3.5 mb-3">
        <div className="grid grid-cols-3 gap-4 items-center">
          <div>
            <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider mb-1">
              Token-per-interaction sensitivity: {tokenMultiplier.toFixed(2)}x
            </div>
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={tokenMultiplier}
              onChange={(e) => setTokenMultiplier(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: "#76B900" }}
            />
            <div className="flex justify-between text-[9px] font-mono text-bep-dim mt-0.5">
              <span>0.5x</span>
              <span>1.0x (baseline)</span>
              <span>3.0x</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider mb-1">Confidence filter</div>
            <div className="flex gap-0 rounded border border-bep-border2 overflow-hidden font-mono text-[11px]">
              <button
                onClick={() => setVerifiedOnly(false)}
                className="flex-1 px-2 py-1.5 transition-colors"
                style={{ background: !verifiedOnly ? "#76B90015" : "transparent", color: !verifiedOnly ? "#76B900" : "#888" }}
              >
                All ({computed.length})
              </button>
              <button
                onClick={() => setVerifiedOnly(true)}
                className="flex-1 px-2 py-1.5 transition-colors"
                style={{ background: verifiedOnly ? "#76B90015" : "transparent", color: verifiedOnly ? "#76B900" : "#888", borderLeft: "1px solid #252525" }}
              >
                Verified pricing only ({computed.filter(isVerified).length})
              </button>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider mb-1">Category</div>
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as any)}
              className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-[11px] text-bep-white font-mono focus:border-bep-green focus:outline-none"
            >
              <option value="all">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Platform margin chart with confidence opacity */}
      <Section
        title="Enterprise AI platform token margins"
        subtitle={`Live blended model cost × per-platform token assumptions vs customer price. Bar opacity = confidence (full = verified pricing + earnings disclosure, faded = modeled estimate). Adjust the slider above to stress-test assumptions.${tokenMultiplier !== 1 ? ` Currently @ ${tokenMultiplier.toFixed(2)}x baseline tokens.` : ""}`}
      >
        <div className="bg-bep-card border border-bep-border rounded-md p-4 mb-3">
          <ResponsiveContainer width="100%" height={Math.max(260, marginData.length * 28)}>
            <BarChart data={marginData} layout="vertical" margin={{ left: 80, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[-350, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} width={100} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v) => [`${Number(v)}%`, "Token margin"]} />
              <ReferenceLine x={0} stroke="#666" />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={22}>
                {marginData.map((d, i) => (
                  <Cell key={i} fill={MARGIN_COLOR(d.margin)} fillOpacity={d.opacity} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-3 text-[9px] font-mono text-bep-muted justify-center mt-1.5 flex-wrap">
            <span><span className="inline-block w-3 h-2 mr-1 align-middle" style={{ background: "#76B900", opacity: 1 }} />Verified high</span>
            <span><span className="inline-block w-3 h-2 mr-1 align-middle" style={{ background: "#76B900", opacity: 0.75 }} />Medium confidence</span>
            <span><span className="inline-block w-3 h-2 mr-1 align-middle" style={{ background: "#76B900", opacity: 0.55 }} />Medium-low</span>
            <span><span className="inline-block w-3 h-2 mr-1 align-middle" style={{ background: "#76B900", opacity: 0.4 }} />Modeled low</span>
          </div>
        </div>

        {/* Platform detail cards — show live blended cost + breakdown */}
        <div className="space-y-2">
          {filtered.map((p) => {
            const margin = p.liveMarginPct;
            const marginColor = MARGIN_COLOR(margin);
            const verified = isVerified(p);
            const confKey = p.estimatedModelCost?.confidence ?? "low";

            return (
              <div
                key={p.id}
                className="bg-bep-card border rounded-md p-3"
                style={{
                  borderStyle: verified ? "solid" : "dashed",
                  borderColor: verified ? "#1a1a1a" : "#252525",
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-bep-white">{p.name}</span>
                    <span className="text-[10px] text-bep-muted font-mono">{p.vendor}</span>
                    <span
                      className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: (CATEGORY_COLOR[p.category] || "#666") + "15",
                        color: CATEGORY_COLOR[p.category] || "#666",
                        border: `1px solid ${(CATEGORY_COLOR[p.category] || "#666")}40`,
                      }}
                    >
                      {p.category?.replace(/-/g, " ")}
                    </span>
                    <span
                      className="text-[8px] font-mono px-1.5 py-0.5 rounded uppercase tracking-wider"
                      style={{
                        background: verified ? "#76B90015" : "#FFB80015",
                        color: verified ? "#76B900" : "#FFB800",
                        border: `1px solid ${verified ? "#76B90040" : "#FFB80040"}`,
                      }}
                    >
                      {verified ? "VERIFIED" : `MODELED (${confKey})`}
                    </span>
                    {p.flagged && (
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#FFB80015] border border-[#FFB80030] text-bep-amber">
                        DATA GAP
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {margin !== null && (
                      <span className="text-lg font-bold font-mono" style={{ color: marginColor }}>
                        {margin > 0 ? "+" : ""}{margin.toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 text-[11px] mb-2">
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Customer pays</div>
                    <div className="font-mono text-bep-white font-semibold">
                      ${p.customerPrice} <span className="text-bep-dim text-[9px]">{p.customerPricing.unit?.replace("$/", "/")}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Blended live $/M</div>
                    <div className="font-mono text-bep-cyan">
                      ${p.blended.costPerM.toFixed(2)}/M
                      {p.blended.missingModels.length > 0 && (
                        <span className="text-[8px] text-bep-amber ml-1">({p.blended.missingModels.length} fallback)</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Cost per unit</div>
                    <div className="font-mono text-bep-amber">
                      {p.liveCostPerUnit !== null
                        ? `$${p.liveCostPerUnit < 0.01 ? p.liveCostPerUnit.toFixed(4) : p.liveCostPerUnit.toFixed(2)}`
                        : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Tokens/interaction</div>
                    <div className="font-mono text-bep-dim">
                      {p.tokensAdjusted !== null
                        ? `${(p.tokensAdjusted / 1000).toFixed(1)}K${tokenMultiplier !== 1 ? ` (${tokenMultiplier.toFixed(1)}x)` : ""}`
                        : "N/A"}
                    </div>
                  </div>
                </div>

                {/* Model mix breakdown */}
                {p.blended.details.length > 0 && (
                  <div className="border-t border-bep-border pt-2 mb-2">
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-1">Live model mix</div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.blended.details.map((d: any, i: number) => (
                        <span
                          key={i}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            background: d.source === "proprietary" ? "#A855F715" : d.source === "fallback" ? "#FFB80015" : "#5BA9FF15",
                            color: d.source === "proprietary" ? "#A855F7" : d.source === "fallback" ? "#FFB800" : "#5BA9FF",
                            border: `1px solid ${d.source === "proprietary" ? "#A855F730" : d.source === "fallback" ? "#FFB80030" : "#5BA9FF30"}`,
                          }}
                          title={`Weight ${(d.weight * 100).toFixed(0)}% × $${d.rate.toFixed(2)}/M = $${d.contribution.toFixed(2)}/M`}
                        >
                          {(d.weight * 100).toFixed(0)}% {d.label.split("/").pop()} @ ${d.rate.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {p.margins?.notes && (
                  <div className="text-[10px] text-bep-dim leading-relaxed mb-1">{p.margins.notes}</div>
                )}
                {p.dataGap && (
                  <div className="text-[10px] text-bep-amber font-mono mb-1">⚠ {p.dataGap}</div>
                )}

                {/* Disclosure links */}
                {p.sourceLinks?.length > 0 && (
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono pt-1.5 border-t border-bep-border mt-1.5">
                    {p.sourceLinks.map((s: any, i: number) => (
                      <a
                        key={i}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-bep-cyan hover:underline no-underline"
                        title={s.type}
                      >
                        {s.label} ↗
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Historical LLMflation back-test — uses REAL token-pricing history */}
      {historicalChart.length > 0 && (
        <Section
          title="LLMflation back-test — derived from real token-pricing history"
          subtitle="Each quarterly point is the closest LLMflation basket snapshot from data/token-pricing/history.json (real model launches, real prices). The green line is the hypothetical Agentforce token margin IF Salesforce had routed every $2 conversation through the basket each quarter, holding price + tokens constant. Real Agentforce routes to cheaper models than the basket, so actual margin tracks higher."
        >
          <div className="bg-bep-card border border-bep-border rounded-md p-4">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={historicalChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="quarter" tick={{ fill: "#666", fontSize: 10 }} />
                <YAxis
                  yAxisId="margin"
                  orientation="left"
                  tick={{ fill: "#76B900", fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[50, 100]}
                  label={{ value: "Hypothetical Agentforce margin %", angle: -90, position: "insideLeft", fill: "#76B900", fontSize: 10 }}
                />
                <YAxis
                  yAxisId="cost"
                  orientation="right"
                  tick={{ fill: "#FF4444", fontSize: 10 }}
                  tickFormatter={(v: number) => `$${v}`}
                  label={{ value: "LLMflation basket $/M", angle: 90, position: "insideRight", fill: "#FF4444", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                  formatter={(value, name) => {
                    const v = Number(value);
                    if (name === "Hypothetical Agentforce margin") return [`${v.toFixed(1)}%`, name];
                    if (name === "LLMflation basket") return [`$${v.toFixed(2)}/M`, name];
                    return [value, name];
                  }}
                />
                <Line yAxisId="cost" type="monotone" dataKey="basketPerM" stroke="#FF4444" strokeWidth={2} name="LLMflation basket" dot={{ r: 3 }} />
                <Line yAxisId="margin" type="monotone" dataKey="agentforceMargin" stroke="#76B900" strokeWidth={2.5} name="Hypothetical Agentforce margin" dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
            <div className="text-[10px] font-mono text-bep-dim text-center mt-2 leading-relaxed">
              LLMflation isn&apos;t monotonic. The visible spike in mid-2025 is real: GPT-4.5 launched at $150/M output, re-inflating the frontier basket. The Q2 2026 drop reflects GPT-5 + Claude Opus 4.6 mass-market pricing. Per-resolution platforms with smart routing avoid the frontier spike entirely — that&apos;s why Salesforce&apos;s actual margin compounded steadily even when the basket re-inflated.
            </div>
          </div>
        </Section>
      )}

      {/* Compression + Arbitrage */}
      {(summary.compression_points?.length > 0 || summary.arbitrage_opportunities?.length > 0) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {summary.compression_points?.length > 0 && (
            <div className="bg-bep-card border border-bep-border rounded-md p-3">
              <div className="text-[10px] font-mono text-bep-amber uppercase tracking-wider mb-2">Compression Points</div>
              {summary.compression_points.map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-bep-dim mb-1.5 last:mb-0">
                  <span className="text-bep-amber mt-0.5 flex-shrink-0">▸</span>
                  <span className="leading-relaxed">{p}</span>
                </div>
              ))}
            </div>
          )}
          {summary.arbitrage_opportunities?.length > 0 && (
            <div className="bg-bep-card border border-bep-border rounded-md p-3">
              <div className="text-[10px] font-mono text-bep-green uppercase tracking-wider mb-2">Arbitrage Opportunities</div>
              {summary.arbitrage_opportunities.map((p: string, i: number) => (
                <div key={i} className="flex items-start gap-2 text-[11px] text-bep-dim mb-1.5 last:mb-0">
                  <span className="text-bep-green mt-0.5 flex-shrink-0">▸</span>
                  <span className="leading-relaxed">{p}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <InsightBox>
        {summary.key_finding}
      </InsightBox>
    </div>
  );
}
