"use client";

import { useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import type { CostPerTaskFile, TokenPriceModel } from "@/lib/data";

interface Props {
  models: TokenPriceModel[];
  workloads: CostPerTaskFile | null;
}

const NEBIUS_GREEN = "#76B900";

const CLOSED_PREFIXES = ["openai/", "anthropic/", "google/", "x-ai/"];

function isClosed(modelId: string): boolean {
  return CLOSED_PREFIXES.some((p) => modelId.toLowerCase().startsWith(p));
}

// Per-task cost = (inputTokens × $/M_in + outputTokens × $/M_out) / 1e6  × turns
function taskCost(
  m: TokenPriceModel,
  inputTokens: number,
  outputTokens: number,
  turns: number,
): number {
  const perTurn = (inputTokens * m.inputPerMillion + outputTokens * m.outputPerMillion) / 1_000_000;
  return perTurn * turns;
}

export default function CostPerTaskCalculator({ models, workloads }: Props) {
  const ws = workloads?.workloads || [];
  const [workloadId, setWorkloadId] = useState<string>(ws[0]?.id || "");
  const [includeClosed, setIncludeClosed] = useState<boolean>(true);
  const [customInputK, setCustomInputK] = useState<number | null>(null);
  const [customOutputK, setCustomOutputK] = useState<number | null>(null);
  const [customTurns, setCustomTurns] = useState<number | null>(null);

  const selected = ws.find((w) => w.id === workloadId) || ws[0];

  const inputTokens = customInputK !== null ? customInputK * 1000 : (selected?.inputTokens ?? 0);
  const outputTokens = customOutputK !== null ? customOutputK * 1000 : (selected?.outputTokens ?? 0);
  const turns = customTurns !== null ? customTurns : (selected?.turns ?? 1);

  const filteredModels = useMemo(
    () => models.filter((m) => m.outputPerMillion > 0 && (includeClosed || !isClosed(m.modelId))),
    [models, includeClosed],
  );

  const rows = useMemo(() => {
    return filteredModels
      .map((m) => ({
        modelId: m.modelId,
        name: m.model,
        provider: m.provider,
        source: m.source || "OpenRouter",
        cost: taskCost(m, inputTokens, outputTokens, turns),
        inPerM: m.inputPerMillion,
        outPerM: m.outputPerMillion,
        ctx: m.contextWindow || 0,
      }))
      .filter((r) => isFinite(r.cost) && r.cost > 0)
      .sort((a, b) => a.cost - b.cost);
  }, [filteredModels, inputTokens, outputTokens, turns]);

  const chartRows = rows.slice(0, 15);

  if (!selected) {
    return (
      <div className="bg-bep-card border border-bep-border rounded-md p-4 text-[12px] text-bep-dim font-mono">
        Workload templates have not been loaded.
      </div>
    );
  }

  const formatCost = (c: number) => {
    if (c >= 1) return `$${c.toFixed(3)}`;
    if (c >= 0.01) return `$${c.toFixed(4)}`;
    return `$${c.toFixed(5)}`;
  };

  return (
    <div>
      <Section
        title="What does this workload actually cost to run?"
        subtitle="Pick a typical AI workload — code completion, RAG Q&A, agent run, support ticket, voice — and see end-to-end cost per task across every model in our panel. Numbers refresh daily from live pricing feeds; token assumptions are typical-case medians, adjustable below."
      >
        <div className="flex flex-wrap gap-1.5 mb-3">
          {ws.map((w) => {
            const active = w.id === selected.id;
            return (
              <button
                key={w.id}
                onClick={() => {
                  setWorkloadId(w.id);
                  setCustomInputK(null);
                  setCustomOutputK(null);
                  setCustomTurns(null);
                }}
                className="px-2.5 py-1 text-[11px] font-mono cursor-pointer rounded transition-colors"
                style={{
                  background: active ? w.color : "#0a0a0a",
                  color: active ? "#050505" : "#999",
                  border: `1px solid ${active ? w.color : "#252525"}`,
                  fontWeight: active ? 700 : 500,
                }}
              >
                {w.name}
              </button>
            );
          })}
        </div>

        <div className="bg-bep-card border border-bep-border rounded-md p-3 mb-4">
          <div className="text-[12px] text-bep-text leading-relaxed mb-3">{selected.description}</div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <NumInput
              label="Input tokens"
              valueK={inputTokens / 1000}
              onChange={(v) => setCustomInputK(v)}
            />
            <NumInput
              label="Output tokens"
              valueK={outputTokens / 1000}
              onChange={(v) => setCustomOutputK(v)}
            />
            <NumInput
              label="Turns / task"
              valueK={turns}
              onChange={(v) => setCustomTurns(v)}
              unit=""
            />
            <div className="flex flex-col gap-1">
              <div className="text-[10px] text-bep-muted uppercase tracking-widest">Tokens / task</div>
              <div className="text-[16px] font-mono font-bold text-bep-white">
                {((inputTokens + outputTokens) * turns).toLocaleString()}
              </div>
            </div>
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-mono text-bep-dim cursor-pointer">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="accent-bep-green"
            />
            include closed-frontier models (OpenAI / Anthropic / Google / xAI)
          </label>

          <div className="text-[10px] font-mono text-bep-dim mt-3 italic leading-relaxed">{selected.exampleCallout}</div>
        </div>

        <div className="bg-bep-card border border-bep-border rounded-md p-3">
          <div style={{ width: "100%", height: Math.max(220, chartRows.length * 26) }}>
            <ResponsiveContainer>
              <BarChart
                data={chartRows.map((r) => ({
                  name: shorten(r.name, 28),
                  cost: r.cost,
                  source: r.source,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 35, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis
                  type="number"
                  stroke="#666"
                  tick={{ fontSize: 10, fontFamily: "monospace" }}
                  tickFormatter={(v) => formatCost(Number(v))}
                />
                <YAxis dataKey="name" type="category" stroke="#666" tick={{ fontSize: 10, fontFamily: "monospace" }} width={190} />
                <Tooltip
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid #252525",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  formatter={(value: unknown) => [formatCost(Number(value)), "Cost / task"]}
                />
                <Bar dataKey="cost" radius={[0, 2, 2, 0]}>
                  {chartRows.map((r, i) => (
                    <Cell key={i} fill={r.source === "Nebius" ? NEBIUS_GREEN : "#444"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-bep-dim mt-2">
            Top 15 cheapest models per this workload · green = Nebius-direct · grey = OpenRouter-listed
          </div>
        </div>
      </Section>

      <Section title="Full ranking" subtitle={`All ${rows.length} eligible models for this workload, cheapest first.`}>
        <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
          <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
            <div className="col-span-1">#</div>
            <div className="col-span-5">Model</div>
            <div className="col-span-2">Source</div>
            <div className="col-span-2 text-right">Context</div>
            <div className="col-span-2 text-right">Cost / task</div>
          </div>
          {rows.map((r, i) => (
            <div
              key={r.modelId}
              className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
              style={{ background: r.source === "Nebius" ? "rgba(118,185,0,0.05)" : "transparent" }}
            >
              <div className="col-span-1 text-bep-dim">{i + 1}</div>
              <div className="col-span-5 text-bep-white truncate" title={r.modelId}>{r.name}</div>
              <div className="col-span-2" style={{ color: r.source === "Nebius" ? NEBIUS_GREEN : "#999" }}>{r.source}</div>
              <div className="col-span-2 text-right text-bep-dim">
                {r.ctx >= 1_000_000 ? `${(r.ctx / 1_000_000).toFixed(1)}M` : r.ctx >= 1000 ? `${Math.round(r.ctx / 1000)}K` : r.ctx}
              </div>
              <div className="col-span-2 text-right text-bep-text">{formatCost(r.cost)}</div>
            </div>
          ))}
        </div>
      </Section>

      <InsightBox>
        Cost-per-task is the unit that actually matters to platform economics — $/M tokens is the wholesale price, not the customer-facing one. The right comparison for any go-to-market decision is &quot;what does it cost to serve one user one task,&quot; multiplied by usage. Token assumptions and turn counts are adjustable above so you can model your own workload shape.
      </InsightBox>
    </div>
  );
}

function NumInput({
  label,
  valueK,
  onChange,
  unit = "K",
}: {
  label: string;
  valueK: number;
  onChange: (v: number | null) => void;
  unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] text-bep-muted uppercase tracking-widest">{label}</label>
      <div className="flex items-baseline gap-1">
        <input
          type="number"
          min={0}
          step={unit === "K" ? 1 : 1}
          value={Number.isFinite(valueK) ? valueK : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            onChange(isFinite(v) ? v : 0);
          }}
          className="bg-[#0a0a0a] border border-bep-border rounded px-2 py-1 text-[14px] font-mono font-bold text-bep-white w-full"
        />
        {unit && <span className="text-[11px] text-bep-dim font-mono">{unit}</span>}
      </div>
    </div>
  );
}

function shorten(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}
