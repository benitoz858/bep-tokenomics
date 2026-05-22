"use client";

import { useMemo, useState } from "react";
import { ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import type { TokenPriceModel } from "@/lib/data";

interface Props {
  models: TokenPriceModel[];
}

// Visual coloring per source so Nebius pops on the chart and the OpenRouter
// aggregate provides the rest of the market reference.
const COLOR_NEBIUS = "#76B900";
const COLOR_OPENROUTER = "#888888";

const CLOSED_PREFIXES = ["openai/", "anthropic/", "google/", "x-ai/"];

type AxisMode = "ctx-vs-cost" | "in-vs-out";

export default function Frontier({ models }: Props) {
  const [mode, setMode] = useState<AxisMode>("ctx-vs-cost");
  const [includeClosed, setIncludeClosed] = useState<boolean>(false);

  const points = useMemo(() => {
    const filtered = models.filter((m) => {
      if (m.outputPerMillion <= 0) return false;
      const isClosed = CLOSED_PREFIXES.some((p) => m.modelId.toLowerCase().startsWith(p));
      if (!includeClosed && isClosed) return false;
      return true;
    });
    return filtered.map((m) => ({
      modelId: m.modelId,
      name: m.model,
      provider: m.provider,
      source: m.source || "OpenRouter",
      x: m.contextWindow || 0,
      y: m.outputPerMillion,
      inputPerMillion: m.inputPerMillion,
    }));
  }, [models, includeClosed]);

  // Pareto frontier for ctx-vs-cost: maximize context, minimize cost.
  // A point is on the frontier if no other point has strictly more context AND
  // less-or-equal cost (or strictly less cost and at least as much context).
  const frontierIds = useMemo(() => {
    if (mode !== "ctx-vs-cost") return new Set<string>();
    const out = new Set<string>();
    for (const p of points) {
      let dominated = false;
      for (const q of points) {
        if (q === p) continue;
        if (q.x >= p.x && q.y <= p.y && (q.x > p.x || q.y < p.y)) {
          dominated = true;
          break;
        }
      }
      if (!dominated) out.add(p.modelId);
    }
    return out;
  }, [points, mode]);

  const dataNebius = points.filter((p) => p.source === "Nebius");
  const dataMarket = points.filter((p) => p.source !== "Nebius");

  return (
    <div>
      <Section
        title="The cost × context frontier"
        subtitle="Every tracked model plotted by output price and context window. Points on the upper-left edge dominate the lower-right ones: more context for less money. Updated daily from the live Nebius Token Factory and OpenRouter feeds."
      >
        <div className="flex flex-wrap gap-1.5 mb-3 items-center">
          <button
            onClick={() => setMode("ctx-vs-cost")}
            className="px-2.5 py-1 text-[11px] font-mono cursor-pointer rounded transition-colors"
            style={{
              background: mode === "ctx-vs-cost" ? COLOR_NEBIUS : "#0a0a0a",
              color: mode === "ctx-vs-cost" ? "#050505" : "#999",
              border: `1px solid ${mode === "ctx-vs-cost" ? COLOR_NEBIUS : "#252525"}`,
              fontWeight: mode === "ctx-vs-cost" ? 700 : 500,
            }}
          >
            Context × Output cost
          </button>
          <button
            onClick={() => setMode("in-vs-out")}
            className="px-2.5 py-1 text-[11px] font-mono cursor-pointer rounded transition-colors"
            style={{
              background: mode === "in-vs-out" ? COLOR_NEBIUS : "#0a0a0a",
              color: mode === "in-vs-out" ? "#050505" : "#999",
              border: `1px solid ${mode === "in-vs-out" ? COLOR_NEBIUS : "#252525"}`,
              fontWeight: mode === "in-vs-out" ? 700 : 500,
            }}
          >
            Input × Output cost
          </button>
          <label className="ml-2 flex items-center gap-1.5 text-[11px] font-mono text-bep-dim cursor-pointer">
            <input
              type="checkbox"
              checked={includeClosed}
              onChange={(e) => setIncludeClosed(e.target.checked)}
              className="accent-bep-green"
            />
            include closed-frontier
          </label>
        </div>

        <div className="bg-bep-card border border-bep-border rounded-md p-3">
          <div style={{ width: "100%", height: 460 }}>
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                {mode === "ctx-vs-cost" ? (
                  <>
                    <XAxis
                      type="number"
                      dataKey="x"
                      name="Context window"
                      stroke="#666"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : `${Math.round(v / 1000)}K`)}
                      label={{ value: "Context window (tokens)", position: "bottom", offset: 10, fill: "#666", fontSize: 11, fontFamily: "monospace" }}
                      scale="log"
                      domain={[1024, "auto"]}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="$/M output"
                      stroke="#666"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => `$${v}`}
                      label={{ value: "$/M output", angle: -90, position: "left", offset: 0, fill: "#666", fontSize: 11, fontFamily: "monospace" }}
                      scale="log"
                      domain={["auto", "auto"]}
                    />
                  </>
                ) : (
                  <>
                    <XAxis
                      type="number"
                      dataKey="inputPerMillion"
                      name="$/M input"
                      stroke="#666"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => `$${v}`}
                      label={{ value: "$/M input", position: "bottom", offset: 10, fill: "#666", fontSize: 11, fontFamily: "monospace" }}
                      scale="log"
                      domain={["auto", "auto"]}
                    />
                    <YAxis
                      type="number"
                      dataKey="y"
                      name="$/M output"
                      stroke="#666"
                      tick={{ fontSize: 10, fontFamily: "monospace" }}
                      tickFormatter={(v) => `$${v}`}
                      label={{ value: "$/M output", angle: -90, position: "left", offset: 0, fill: "#666", fontSize: 11, fontFamily: "monospace" }}
                      scale="log"
                      domain={["auto", "auto"]}
                    />
                  </>
                )}
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3", stroke: "#444" }}
                  contentStyle={{
                    background: "#0a0a0a",
                    border: "1px solid #252525",
                    borderRadius: 4,
                    fontSize: 11,
                    fontFamily: "monospace",
                  }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  content={(props: any) => {
                    if (!props.active || !props.payload || props.payload.length === 0) return null;
                    const p = props.payload[0].payload as (typeof points)[number];
                    const onFrontier = frontierIds.has(p.modelId);
                    return (
                      <div className="bg-bep-card border border-bep-border rounded p-2 font-mono text-[11px]">
                        <div className="text-bep-white font-bold">{p.name}</div>
                        <div className="text-bep-dim">{p.modelId}</div>
                        <div className="mt-1 text-bep-text">
                          Context: {p.x >= 1_000_000 ? `${(p.x / 1_000_000).toFixed(1)}M` : `${Math.round(p.x / 1000)}K`} tokens
                        </div>
                        <div className="text-bep-text">$/M in: ${p.inputPerMillion.toFixed(2)}</div>
                        <div className="text-bep-text">$/M out: ${p.y.toFixed(2)}</div>
                        <div className="text-bep-dim mt-1">Source: {p.source}</div>
                        {onFrontier && <div style={{ color: COLOR_NEBIUS }} className="mt-1">✦ on Pareto frontier</div>}
                      </div>
                    );
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ fontSize: 11, fontFamily: "monospace", color: "#999" }}
                />
                <Scatter name="Nebius" data={dataNebius} fill={COLOR_NEBIUS}>
                  {dataNebius.map((p, i) => (
                    <Cell key={i} fill={frontierIds.has(p.modelId) ? COLOR_NEBIUS : "#3a4a1a"} />
                  ))}
                </Scatter>
                <Scatter name="Market (OpenRouter)" data={dataMarket} fill={COLOR_OPENROUTER}>
                  {dataMarket.map((p, i) => (
                    <Cell key={i} fill={frontierIds.has(p.modelId) ? COLOR_OPENROUTER : "#333"} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </div>
          <div className="text-[10px] font-mono text-bep-dim mt-2">
            Log scales on both axes · brighter points dominate dimmer ones · hover for details
          </div>
        </div>
      </Section>

      {mode === "ctx-vs-cost" && (
        <Section title="On the frontier" subtitle="Models on the Pareto edge — no other tracked model offers both more context AND lower output cost.">
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
              <div className="col-span-6">Model</div>
              <div className="col-span-2">Source</div>
              <div className="col-span-2 text-right">Context</div>
              <div className="col-span-2 text-right">$/M out</div>
            </div>
            {points
              .filter((p) => frontierIds.has(p.modelId))
              .sort((a, b) => b.x - a.x)
              .map((p) => (
                <div
                  key={p.modelId}
                  className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
                  style={{ background: p.source === "Nebius" ? "rgba(118,185,0,0.06)" : "transparent" }}
                >
                  <div className="col-span-6 text-bep-white">{p.name}</div>
                  <div className="col-span-2" style={{ color: p.source === "Nebius" ? COLOR_NEBIUS : "#999" }}>{p.source}</div>
                  <div className="col-span-2 text-right text-bep-text">
                    {p.x >= 1_000_000 ? `${(p.x / 1_000_000).toFixed(1)}M` : `${Math.round(p.x / 1000)}K`}
                  </div>
                  <div className="col-span-2 text-right text-bep-text">${p.y.toFixed(2)}</div>
                </div>
              ))}
          </div>
        </Section>
      )}

      <InsightBox>
        Quality-weighted version of this chart (Artificial Analysis Quality Index × $/M) is on the roadmap — meaningful integration requires a stable benchmark snapshot we can refresh on the same daily cadence as the price feeds. For now, context × cost is the cleanest derivable Pareto frontier from purely live data.
      </InsightBox>
    </div>
  );
}
