"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import { formatPrice } from "@/lib/calculations";
import type { ProviderEndpointsFile, TokenPriceModel } from "@/lib/data";

interface Props {
  endpoints: ProviderEndpointsFile | null;
  nebiusModels: TokenPriceModel[];
}

// Normalize so a Nebius slug ("meta-llama/Llama-3.3-70B-Instruct") matches an
// OpenRouter slug ("meta-llama/llama-3.3-70b-instruct").
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[-_]/g, "").split("/").pop() || id.toLowerCase();
}

const NEBIUS_GREEN = "#76B900";

// Display labels for the OpenRouter modelIds we track; ordered by interest.
const MODEL_LABELS: Array<{ id: string; label: string }> = [
  { id: "meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B Instruct" },
  { id: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
  { id: "deepseek/deepseek-v3.2", label: "DeepSeek V3.2" },
  { id: "deepseek/deepseek-r1", label: "DeepSeek R1" },
  { id: "moonshotai/kimi-k2.5", label: "Kimi K2.5" },
  { id: "minimax/minimax-m2.5", label: "MiniMax M2.5" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B" },
  { id: "mistralai/mistral-large", label: "Mistral Large" },
  { id: "qwen/qwen3-32b", label: "Qwen3 32B" },
  { id: "qwen/qwen3-235b-a22b-instruct-2507", label: "Qwen3 235B Instruct" },
  { id: "google/gemma-3-27b-it", label: "Gemma 3 27B" },
];

export default function ProviderMap({ endpoints, nebiusModels }: Props) {
  // Build a Nebius-side lookup once: normalized id → { input, output, contextWindow }.
  const nebiusByNorm = useMemo(() => {
    const m = new Map<string, { in: number; out: number; ctx: number }>();
    for (const n of nebiusModels) {
      m.set(normalizeId(n.modelId), {
        in: n.inputPerMillion,
        out: n.outputPerMillion,
        ctx: n.contextWindow || 0,
      });
    }
    return m;
  }, [nebiusModels]);

  const availableModels = MODEL_LABELS.filter(
    (m) => endpoints?.models?.[m.id]?.endpoints?.length || nebiusByNorm.has(normalizeId(m.id)),
  );

  const [selectedId, setSelectedId] = useState<string>(availableModels[0]?.id || MODEL_LABELS[0].id);

  const rowsForChart = useMemo(() => {
    const orEndpoints = endpoints?.models?.[selectedId]?.endpoints || [];
    const rows: Array<{ provider: string; output: number; input: number; ctx: number; isNebius: boolean }> = [];
    const nebMatch = nebiusByNorm.get(normalizeId(selectedId));
    if (nebMatch) {
      rows.push({ provider: "Nebius", output: nebMatch.out, input: nebMatch.in, ctx: nebMatch.ctx, isNebius: true });
    }
    for (const e of orEndpoints) {
      rows.push({
        provider: e.providerName,
        output: e.outputPerMillion,
        input: e.inputPerMillion,
        ctx: e.contextLength || 0,
        isNebius: false,
      });
    }
    return rows.sort((a, b) => a.output - b.output);
  }, [endpoints, selectedId, nebiusByNorm]);

  const hasAnyData = (endpoints?.modelCount ?? 0) > 0 || nebiusByNorm.size > 0;

  // Cross-model coverage map: for each tracked model, how many providers serve
  // it (across OpenRouter endpoints + Nebius if applicable).
  const coverage = useMemo(() => {
    return MODEL_LABELS.map((m) => {
      const or = endpoints?.models?.[m.id]?.endpoints?.length || 0;
      const onNebius = nebiusByNorm.has(normalizeId(m.id)) ? 1 : 0;
      return {
        modelId: m.id,
        label: m.label,
        orProviders: or,
        onNebius,
        total: or + onNebius,
      };
    }).sort((a, b) => b.total - a.total);
  }, [endpoints, nebiusByNorm]);

  return (
    <div>
      <Section
        title="Where do open models actually live?"
        subtitle="Live competitive map of inference providers for the open-weights models the industry routes. For each tracked model: every provider serving it via OpenRouter, plus direct Nebius pricing where Nebius hosts the same weights. Pricing refreshed daily."
      >
        {!hasAnyData ? (
          <div className="bg-bep-card border border-bep-border rounded-md p-4 text-[12px] text-bep-dim font-mono">
            Provider endpoint data has not been fetched yet — the daily cron will populate this view on the next run.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {availableModels.map((m) => {
                const active = m.id === selectedId;
                return (
                  <button
                    key={m.id}
                    onClick={() => setSelectedId(m.id)}
                    className="px-2.5 py-1 text-[11px] font-mono cursor-pointer rounded transition-colors"
                    style={{
                      background: active ? NEBIUS_GREEN : "#0a0a0a",
                      color: active ? "#050505" : "#999",
                      border: `1px solid ${active ? NEBIUS_GREEN : "#252525"}`,
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {rowsForChart.length === 0 ? (
              <div className="bg-bep-card border border-bep-border rounded-md p-4 text-[12px] text-bep-dim font-mono">
                No provider data for this model yet.
              </div>
            ) : (
              <div className="bg-bep-card border border-bep-border rounded-md p-3">
                <div style={{ width: "100%", height: Math.max(220, rowsForChart.length * 34) }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={rowsForChart.map((r) => ({
                        name: r.provider,
                        output: round(r.output, 3),
                        input: round(r.input, 3),
                        isNebius: r.isNebius,
                      }))}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                      <XAxis
                        type="number"
                        stroke="#666"
                        tick={{ fontSize: 10, fontFamily: "monospace" }}
                        tickFormatter={(v) => `$${v}`}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        stroke="#666"
                        tick={{ fontSize: 10, fontFamily: "monospace" }}
                        width={130}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#0a0a0a",
                          border: "1px solid #252525",
                          borderRadius: 4,
                          fontSize: 11,
                          fontFamily: "monospace",
                        }}
                        formatter={(value: unknown, name: unknown) => [`$${Number(value)}/M`, String(name)]}
                      />
                      <Bar dataKey="output" radius={[0, 2, 2, 0]}>
                        {rowsForChart.map((r, i) => (
                          <Cell key={i} fill={r.isNebius ? NEBIUS_GREEN : "#444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] font-mono text-bep-dim mt-2">
                  $/M output tokens · green = Nebius direct (Token Factory API) · grey = OpenRouter-listed provider
                </div>
              </div>
            )}

            <div className="mt-4 bg-bep-card border border-bep-border rounded-md overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
                <div className="col-span-3">Provider</div>
                <div className="col-span-2 text-right">$/M in</div>
                <div className="col-span-2 text-right">$/M out</div>
                <div className="col-span-2 text-right">Context</div>
                <div className="col-span-3">Source</div>
              </div>
              {rowsForChart.map((r, i) => (
                <div
                  key={`${r.provider}-${i}`}
                  className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
                  style={{ background: r.isNebius ? "rgba(118,185,0,0.06)" : "transparent" }}
                >
                  <div className="col-span-3" style={{ color: r.isNebius ? NEBIUS_GREEN : "#f0f0f0", fontWeight: r.isNebius ? 700 : 400 }}>
                    {r.provider}
                  </div>
                  <div className="col-span-2 text-right text-bep-text">{formatPrice(r.input)}</div>
                  <div className="col-span-2 text-right text-bep-text">{formatPrice(r.output)}</div>
                  <div className="col-span-2 text-right text-bep-dim">
                    {r.ctx >= 1_000_000 ? `${(r.ctx / 1_000_000).toFixed(1)}M` : r.ctx >= 1000 ? `${Math.round(r.ctx / 1000)}K` : r.ctx.toString()}
                  </div>
                  <div className="col-span-3 text-bep-dim">{r.isNebius ? "Nebius API" : "OpenRouter"}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Section>

      <Section title="Cross-model provider coverage" subtitle="How many providers serve each tracked open model right now. Higher coverage = more commoditized.">
        <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
            <div className="col-span-5">Model</div>
            <div className="col-span-2 text-right">On Nebius</div>
            <div className="col-span-2 text-right">OR providers</div>
            <div className="col-span-3 text-right">Total hosts</div>
          </div>
          {coverage.map((c) => (
            <div key={c.modelId} className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border">
              <div className="col-span-5 text-bep-white">{c.label}</div>
              <div className="col-span-2 text-right" style={{ color: c.onNebius ? NEBIUS_GREEN : "#444" }}>
                {c.onNebius ? "yes" : "no"}
              </div>
              <div className="col-span-2 text-right text-bep-text">{c.orProviders}</div>
              <div className="col-span-3 text-right text-bep-dim">{c.total}</div>
            </div>
          ))}
        </div>
      </Section>

      <InsightBox>
        Open-weights inference is the cleanest commodity battleground in AI right now. Providers that host the same weights at materially different prices are running different stacks (quantization, batching, hardware) under the hood — the price spread is the visible signal. Nebius&apos; positioning is breadth + reliability at the long-tail end; price-aggressive providers cluster on the high-volume models.
      </InsightBox>
    </div>
  );
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
