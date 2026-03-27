"use client";

import { LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, ReferenceArea, Cell, Area } from "recharts";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Props {
  data: any;
}

export default function InferenceProviderMargins({ data }: Props) {
  if (!data) return null;

  const labMargins = data.labMargins || [];
  const curves = data.interactivityModel?.curves || {};
  const sustainableRange = data.sustainableMarginRange || { low: 50, high: 75 };

  // ── Chart 1: AI Inference Gross Margins (2024) — the bar chart
  const margins2024 = labMargins.map((lab: any) => {
    const point = lab.dataPoints.find((d: any) => d.year === 2024);
    return point ? { lab: lab.lab, margin: point.grossMarginPct, color: lab.color, note: point.note } : null;
  }).filter(Boolean);

  // ── Chart 2: Gross Margin vs Interactivity
  const curveKeys = Object.keys(curves);
  // Merge all curves into one dataset keyed by interactivity
  const interactivityData: any[] = [];
  if (curveKeys.length > 0) {
    const firstCurve = curves[curveKeys[0]];
    for (const point of firstCurve.points) {
      const row: any = { interactivity: point.interactivity };
      for (const key of curveKeys) {
        const c = curves[key];
        const p = c.points.find((p: any) => p.interactivity === point.interactivity);
        row[c.label] = p?.marginPct ?? null;
      }
      interactivityData.push(row);
    }
  }

  // ── Chart 3: Convergence timeline
  const years = [2023, 2024, 2025, 2026, 2027, 2028];
  const convergenceData = years.map((year) => {
    const row: any = { year: year.toString() };
    for (const lab of labMargins) {
      const point = lab.dataPoints.find((d: any) => d.year === year);
      row[lab.lab] = point?.grossMarginPct ?? null;
      row[`${lab.lab}_type`] = point?.type ?? null;
    }
    return row;
  });

  return (
    <div>
      {/* Hero: 2024 margins */}
      <div className="grid grid-cols-3 gap-2.5 mb-5">
        {margins2024.map((m: any) => (
          <Metric key={m.lab} label={`${m.lab} (2024)`} value={`${m.margin}%`}
            sub={m.note} color={m.margin < 0 ? "#FF4444" : "#76B900"} />
        ))}
      </div>

      {/* Chart 1: Gross Margin vs Interactivity */}
      <Section title="Gross Margin vs. Interactivity" subtitle="Interactivity (tok/sec/user) is the dial between margin and user happiness. H200 margins go negative above 50 tok/s/user. B200 stays at 70%+. B200+LPX stays at 80%+. Hardware generation determines whether inference is profitable.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={interactivityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="interactivity" tick={{ fill: "#666", fontSize: 10 }}
                label={{ value: "Interactivity (tok/user/s)", position: "insideBottom", offset: -5, fill: "#666", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`}
                domain={[-40, 100]}
                label={{ value: "Predicted Gross Margin", angle: -90, position: "insideLeft", fill: "#666", fontSize: 10, dx: -10 }} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v, name) => [`${Number(v).toFixed(0)}%`, name]}
                labelFormatter={(l) => `${l} tok/user/s`} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
              <ReferenceArea y1={sustainableRange.low} y2={sustainableRange.high} fill="#76B900" fillOpacity={0.05}
                label={{ value: "BEP Est. Sustainable Range", position: "insideTopRight", fill: "#76B90060", fontSize: 9 }} />
              {curveKeys.map((key) => {
                const c = curves[key];
                return (
                  <Line key={key} type="monotone" dataKey={c.label} stroke={c.color}
                    strokeWidth={key.includes("lpx") ? 3 : 2}
                    strokeDasharray={key.includes("lpx") ? "8 4" : undefined}
                    dot={{ r: 3, fill: c.color }} connectNulls />
                );
              })}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted justify-center">
            {curveKeys.map((key) => {
              const c = curves[key];
              return (
                <span key={key}>
                  <span style={{ color: c.color }}>{key.includes("lpx") ? "┅┅" : "──"}</span> {c.label}
                </span>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Chart 2: 2024 gross margins bar */}
      <Section title="AI Inference Gross Margins (2024)" subtitle="The 'race to the bottom' — before the inflection. Anthropic burned at -94% gross margin on paying customers. MiniMax at -25%. Zhipu nearly breakeven at -0.4%. Then Zhipu raised prices 30% in Feb 2026 and sold out instantly. ARR went 25x in 10 months.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={margins2024} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="lab" tick={{ fill: "#f0f0f0", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`}
                domain={[-100, 10]} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v) => [`${Number(v)}%`, "Gross Margin"]} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
              <Bar dataKey="margin" radius={[4, 4, 0, 0]} barSize={60}>
                {margins2024.map((m: any, i: number) => (
                  <Cell key={i} fill={m.margin < -50 ? "#FF4444" : m.margin < 0 ? "#FF6B6B" : "#76B900"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="text-[10px] text-bep-muted font-mono text-center mt-2">
            Sources: The Information (Anthropic), IPO prospectus (MiniMax, Zhipu)
          </div>
        </div>
      </Section>

      {/* Chart 3: Convergence to ~60% */}
      <Section title="Converging on ~60%: Not a Race to Zero" subtitle="Labs from both sides of the Pacific trending toward sustainable margins. Anthropic: -94% → 40% (revised up from 25%) → 77% target. MiniMax: -25% → 35% projected. BEP Research estimates sustainable range: 50-75%.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={convergenceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="year" tick={{ fill: "#f0f0f0", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`}
                domain={[-100, 85]} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                formatter={(v, name) => [`${Number(v)}%`, name]} />
              <ReferenceLine y={0} stroke="#666" strokeDasharray="4 4" />
              <ReferenceArea y1={sustainableRange.low} y2={sustainableRange.high} fill="#76B900" fillOpacity={0.06}
                label={{ value: "BEP Est. Sustainable Range (50-75%)", position: "insideTopRight", fill: "#76B90080", fontSize: 9 }} />
              {labMargins.map((lab: any) => (
                <Line key={lab.lab} type="monotone" dataKey={lab.lab} stroke={lab.color}
                  strokeWidth={2.5} dot={{ r: 5, fill: lab.color, stroke: "#050505", strokeWidth: 2 }}
                  connectNulls />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted justify-center">
            {labMargins.map((lab: any) => (
              <span key={lab.lab}><span style={{ color: lab.color }}>●──</span> {lab.lab}</span>
            ))}
            <span>── Actual</span>
            <span>┄┄ Projected</span>
          </div>

          {/* Key data points as callouts */}
          <div className="grid grid-cols-3 gap-2 mt-4">
            {labMargins.map((lab: any) => (
              <div key={lab.lab} className="bg-bep-bg border border-bep-border rounded p-2.5">
                <div className="text-xs font-bold mb-1" style={{ color: lab.color }}>{lab.lab}</div>
                {lab.dataPoints.map((d: any, i: number) => (
                  <div key={i} className="flex justify-between text-[10px] font-mono">
                    <span className="text-bep-muted">{d.year} <span className={d.type === "actual" ? "text-bep-white" : "text-bep-dim"}>({d.type})</span></span>
                    <span style={{ color: d.grossMarginPct < 0 ? "#FF4444" : "#76B900" }}>{d.grossMarginPct}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Section>

      <InsightBox>
        This is the thread that connects everything in Tokenomics. Interactivity (tok/sec/user) is the dial. At low interactivity, even H200 is profitable. At high interactivity (what users want), H200 goes negative — you need B200 or LPX to stay in the money. That&apos;s why Anthropic&apos;s margins went from -94% to 40% in one year: better hardware + pricing power. Zhipu proved it — raised prices 30%, sold out instantly. Inference is not a commodity. It&apos;s a managed experience priced by quality of service. The hardware determines whether that experience is profitable.
      </InsightBox>
    </div>
  );
}
