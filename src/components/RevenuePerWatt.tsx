"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import type { RevenuePerWattPlatform } from "@/lib/data";

const PLATFORM_COLORS: Record<string, string> = {
  "Hopper H100": "#666",
  "Blackwell NVL72": "#FFB800",
  "Vera Rubin NVL72": "#00D4FF",
  "VR + Groq LPX": "#76B900",
};

interface Props {
  platforms: RevenuePerWattPlatform[];
  derivation: { title: string; steps: string[] };
}

export default function RevenuePerWatt({ platforms, derivation }: Props) {
  const chartData = platforms.map((p) => ({
    ...p,
    color: PLATFORM_COLORS[p.platform] || "#666",
  }));

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        {platforms.map((r) => (
          <Metric
            key={r.platform}
            label={r.platform}
            value={`$${r.revPerSecPerMW}`}
            sub={`/sec/MW · ${r.tokPerSecPerUser} tok/s/user`}
            color={PLATFORM_COLORS[r.platform] || "#666"}
          />
        ))}
      </div>

      <Section title="Revenue Per Second Per Megawatt" subtitle="From Jensen's GTC 2026 slide. Same building, same power budget — 10x the revenue from Blackwell to VR+LPX.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="platform" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                formatter={(v) => [`$${v}/sec/MW`, "Revenue"]}
                contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }}
              />
              <Bar dataKey="revPerSecPerMW" radius={[4, 4, 0, 0]} barSize={50}>
                {chartData.map((r, i) => <Cell key={i} fill={r.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title={derivation.title} subtitle="Jensen's claim: $300B annual revenue per gigawatt with VR+LPX. Here's the chain.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4 text-[12.5px] text-bep-dim leading-[1.8]">
          {derivation.steps.map((step, i) => (
            <div key={i} className="mb-2">
              <span className="text-bep-cyan">{step.split(":")[0]}:</span>{step.substring(step.indexOf(":") + 1)}
            </div>
          ))}
          <div className="border-t border-bep-border pt-2.5 mt-2.5 text-bep-green font-mono text-[11px]">
            Power is fixed. Real estate is fixed. Revenue scales with tokens/watt. That&apos;s why every constraint (memory, packaging, optical) ultimately flows through to $/token/watt.
          </div>
        </div>
      </Section>
    </div>
  );
}
