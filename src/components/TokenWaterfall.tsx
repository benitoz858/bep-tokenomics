"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Section from "./ui/Section";
import Metric from "./ui/Metric";
import InsightBox from "./ui/InsightBox";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface LiveStages {
  h100SpotPerHr: number;
  h100TcoPerHr: number;
  h100CostPerM: number;
  h100TokPerSec: number;
}

interface Props {
  data: any;
  liveStages?: LiveStages;
}

const MARGIN_COLORS = (pct: number) =>
  pct > 80 ? "#76B900" : pct > 50 ? "#00D4FF" : pct > 20 ? "#FFB800" : pct > 0 ? "#FF6B6B" : "#FF4444";

export default function TokenWaterfall({ data, liveStages }: Props) {
  if (!data) return null;

  const platforms = data.platforms || [];
  const summary = data.waterfall_summary || {};

  // Live H100 → token production cost; falls back to prior reference values if data unavailable
  const h100Tco = liveStages?.h100TcoPerHr || 3.00;
  const h100CostPerM = liveStages?.h100CostPerM || 8.77;
  const h100TokPerSec = liveStages?.h100TokPerSec || 95;

  // Anthropic Sonnet 4.6 output price ($15/M) and Salesforce Agentforce $2/conv at ~6K tokens/conv
  const SONNET_PRICE = 15;
  const SALESFORCE_PER_CONV = 2;
  const TOKENS_PER_CONV = 6000;
  const platformPricePerM = (SALESFORCE_PER_CONV / TOKENS_PER_CONV) * 1_000_000;

  // Waterfall stages chart — derived from live GPU pricing
  const waterfallStages = [
    { stage: "GPU Rental", cost: h100Tco, label: `H100 TCO $/hr (1.25x spot)`, color: "#555" },
    { stage: "Token Production", cost: h100CostPerM, label: `$/M tokens — Llama 70B on H100 (${h100TokPerSec} tok/s)`, color: "#FFB800" },
    { stage: "API Sell Price", cost: SONNET_PRICE, label: "Anthropic Sonnet 4.6 output $/M", color: "#00D4FF" },
    { stage: "Platform Price", cost: platformPricePerM, label: `Salesforce $${SALESFORCE_PER_CONV}/conv → $/M equiv (${TOKENS_PER_CONV / 1000}K tokens)`, color: "#76B900" },
  ];

  // Platform margin comparison
  const marginData = platforms
    .filter((p: any) => {
      const m = p.margins?.platformMarginPct;
      return m !== null && m !== undefined;
    })
    .map((p: any) => ({
      name: p.vendor,
      product: p.name,
      margin: p.margins.platformMarginPct,
      price: p.customerPricing?.price,
      unit: p.customerPricing?.unit,
      model: p.customerPricing?.model,
      flagged: p.flagged,
    }))
    .sort((a: any, b: any) => b.margin - a.margin);

  // Key metrics
  const highestMargin = marginData[0];
  const lowestMargin = marginData[marginData.length - 1];

  return (
    <div>
      {/* Hero metrics — live where possible */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Metric
          label="GPU → Token"
          value={`$${h100Tco.toFixed(2)} → $${h100CostPerM.toFixed(2)}`}
          sub={`H100 TCO/hr → $/M (Llama 70B)`}
          color="#FFB800"
        />
        <Metric
          label="Token → API"
          value={`$${h100CostPerM.toFixed(2)} → $${SONNET_PRICE}`}
          sub="Production to Sonnet 4.6 sell"
          color="#00D4FF"
        />
        <Metric
          label="API → Platform"
          value={`$${SONNET_PRICE} → $${platformPricePerM.toFixed(0)}`}
          sub={`Sonnet $/M → Salesforce $/M equiv`}
          color="#76B900"
        />
        <Metric label="Highest Platform Margin" value={highestMargin ? `${highestMargin.margin}%` : "—"} sub={highestMargin?.name || ""} color="#76B900" />
      </div>

      {/* Waterfall chart */}
      <Section title="Token Cost Waterfall" subtitle="Follow $1 of GPU compute through the stack. Each layer adds margin. By the time a token reaches an enterprise customer, the markup is 50-180x the hardware cost.">
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

      {/* Platform margin comparison */}
      <Section title="Enterprise AI Platform Margins" subtitle="What platforms charge customers vs what they pay model providers. The distribution layer captures the lion's share of AI value.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4 mb-3">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={marginData} layout="vertical" margin={{ left: 80, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} domain={[-350, 100]} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v) => [`${Number(v)}%`, "Platform Margin"]} />
              <Bar dataKey="margin" radius={[0, 4, 4, 0]} barSize={22}>
                {marginData.map((d: any, i: number) => <Cell key={i} fill={MARGIN_COLORS(d.margin)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Platform detail cards */}
        <div className="space-y-2">
          {platforms.filter((p: any) => p.customerPricing?.price).map((p: any) => {
            const margin = p.margins?.platformMarginPct;
            const marginColor = margin !== null ? MARGIN_COLORS(margin) : "#666";

            return (
              <div key={p.id} className="bg-bep-card border border-bep-border rounded-md p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-semibold text-bep-white">{p.name}</span>
                    <span className="text-[10px] text-bep-muted ml-2 font-mono">{p.vendor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.flagged && (
                      <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#FFB80015] border border-[#FFB80030] text-bep-amber">
                        DATA GAP
                      </span>
                    )}
                    {margin !== null && (
                      <span className="text-lg font-bold font-mono" style={{ color: marginColor }}>
                        {margin > 0 ? "+" : ""}{margin}%
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Customer pays</div>
                    <div className="font-mono text-bep-white font-semibold">
                      ${p.customerPricing.price} <span className="text-bep-dim text-[9px]">{p.customerPricing.unit?.replace("$/", "/")}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Model provider</div>
                    <div className="font-mono text-bep-dim text-[10px]">{p.modelProvider}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-bep-muted uppercase font-mono mb-0.5">Est. model cost</div>
                    <div className="font-mono text-bep-cyan">
                      {p.estimatedModelCost?.costPerConversation
                        ? `$${p.estimatedModelCost.costPerConversation}/conv`
                        : p.estimatedModelCost?.costPerResolution
                          ? `$${p.estimatedModelCost.costPerResolution}/res`
                          : p.estimatedModelCost?.monthlyModelCostPerUser
                            ? `$${p.estimatedModelCost.monthlyModelCostPerUser}/user/mo`
                            : "—"}
                    </div>
                  </div>
                </div>

                {p.margins?.notes && (
                  <div className="text-[10px] text-bep-dim mt-2 leading-relaxed">{p.margins.notes}</div>
                )}
                {p.dataGap && (
                  <div className="text-[10px] text-bep-amber mt-1 font-mono">{p.dataGap}</div>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* Compression points + Arbitrage */}
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

      {/* Key finding */}
      <InsightBox>
        {summary.key_finding || "Margin concentrates at the distribution layer. Enterprise platforms capture 90%+ margins on AI while model providers operate at 20-60% and GPU providers at single digits. The platform is the moat, not the model."}
      </InsightBox>
    </div>
  );
}
