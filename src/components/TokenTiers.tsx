"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import { TIER_COLORS } from "@/lib/calculations";
import type { NVIDIATier } from "@/lib/data";

interface Props {
  tiers: NVIDIATier[];
}

export default function TokenTiers({ tiers }: Props) {
  const chartData = tiers.map((t) => ({
    tier: t.tier,
    price: t.pricePerMillionOutput,
    color: TIER_COLORS[t.tier] || "#666",
  }));

  return (
    <div>
      <Section title="NVIDIA's Five Inference Pricing Tiers" subtitle="From GTC 2026 keynote. Jensen segmented inference into five distinct markets — not a commodity. The LPX rack unlocks the top two tiers that were physically impossible before.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} domain={[0, 160]} />
              <YAxis type="category" dataKey="tier" tick={{ fill: "#f0f0f0", fontSize: 12 }} />
              <Tooltip
                formatter={(v) => [`$${v}/M tokens`, "Price"]}
                contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }}
              />
              <Bar dataKey="price" radius={[0, 4, 4, 0]} barSize={28}>
                {chartData.map((t, i) => <Cell key={i} fill={t.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {tiers.map((t) => (
        <div key={t.tier} className="flex gap-3 p-2.5 px-3.5 bg-bep-card border border-bep-border rounded-md mb-1.5 items-center">
          <span className="font-mono text-sm font-bold min-w-[70px]" style={{ color: TIER_COLORS[t.tier] }}>{t.tier}</span>
          <span className="font-mono text-[13px] text-bep-white min-w-[55px]">${t.pricePerMillionOutput}/M</span>
          <span className="text-xs text-bep-dim flex-1">{t.workload}</span>
          <span className="text-[10px] font-mono whitespace-nowrap" style={{ color: t.lpxRequired ? "#76B900" : "#666" }}>{t.hardware}</span>
        </div>
      ))}

      <div className="mt-3">
        <InsightBox>
          The $0–$6 tiers are where GPU-only inference competes on cost. The $45–$150 tiers require LPX decode acceleration — this is additive TAM the street isn&apos;t modeling. Same power budget, same building, 10x the revenue. The token is the unit of revenue. The LPU is where the margin lives.
        </InsightBox>
      </div>
    </div>
  );
}
