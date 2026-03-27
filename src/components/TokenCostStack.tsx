"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import type { CostStackComponent } from "@/lib/data";

interface Props {
  components: CostStackComponent[];
  insight: string;
}

export default function TokenCostStack({ components, insight }: Props) {
  const chartData = [
    { name: "Blackwell", ...Object.fromEntries(components.map((c) => [c.component, c.pctBlackwell])) },
    { name: "Vera Rubin", ...Object.fromEntries(components.map((c) => [c.component, c.pctRubin])) },
    { name: "VR + LPX", ...Object.fromEntries(components.map((c) => [c.component, c.pctRubinLPX])) },
  ];

  return (
    <div>
      <Section title="What's Inside a Token?" subtitle="Estimated cost decomposition of a single inference token by physical component. As architecture shifts from GPU-only to GPU+LPX, memory's share of token cost increases — validating the Memory Wars thesis.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 12 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }} formatter={(v) => `${v}%`} />
              {components.map((c) => (
                <Bar key={c.component} dataKey={c.component} stackId="a" fill={c.color} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="text-[11px] text-bep-muted font-mono mb-3 tracking-wider">COMPONENT BREAKDOWN BY PLATFORM</div>
      {components.map((c) => (
        <div key={c.component} className="grid items-center p-2 px-3.5 bg-bep-card border border-bep-border rounded mb-1"
          style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <span className="text-xs font-medium" style={{ color: c.color }}>{c.component}</span>
          <span className="text-xs text-bep-dim font-mono text-center">{c.pctBlackwell}%</span>
          <span className="text-xs text-bep-dim font-mono text-center">{c.pctRubin}%</span>
          <span className="text-xs text-bep-white font-mono text-center font-semibold">{c.pctRubinLPX}%</span>
        </div>
      ))}
      <div className="grid text-[10px] text-bep-muted font-mono px-3.5 py-1"
        style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
        <span></span>
        <span className="text-center">Blackwell</span>
        <span className="text-center">Vera Rubin</span>
        <span className="text-center">VR + LPX</span>
      </div>

      <div className="mt-3.5">
        <InsightBox>{insight}</InsightBox>
      </div>
    </div>
  );
}
