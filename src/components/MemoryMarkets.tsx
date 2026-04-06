"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Section from "./ui/Section";
import Metric from "./ui/Metric";
import InsightBox from "./ui/InsightBox";
import type { OrnnMemoryPricing } from "@/lib/data";

interface Props {
  data: OrnnMemoryPricing;
}

export default function MemoryMarkets({ data }: Props) {
  const rdimm = data.current.find(m => m.key === "ddr5-rdimm-32gb");
  const chip = data.current.find(m => m.key === "ddr5-16gb-chip");
  const ett = data.current.find(m => m.key === "ddr5-16gb-ett");

  // Build chart data for DDR5 RDIMM
  const rdimmHistory = data.history["ddr5-rdimm-32gb"] || [];
  // Sample every 3rd day for readability
  const step = rdimmHistory.length > 60 ? 3 : rdimmHistory.length > 30 ? 2 : 1;
  const chartData = rdimmHistory
    .filter((_, i) => i % step === 0)
    .map(d => ({
      date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      price: d.price,
    }));

  // Calculate change from first to last
  const firstPrice = rdimmHistory.length > 0 ? rdimmHistory[0].price : null;
  const lastPrice = rdimmHistory.length > 0 ? rdimmHistory[rdimmHistory.length - 1].price : null;
  const totalChange = firstPrice && lastPrice ? Math.round(((lastPrice - firstPrice) / firstPrice) * 100) : null;

  return (
    <Section
      title="Memory Markets"
      subtitle={`DRAM and module spot pricing from Ornn AI. Memory cost is the rising share of GPU TCO.`}
    >
      <div className="grid grid-cols-3 gap-2 mb-3">
        <Metric
          label="DDR5 RDIMM 32GB"
          value={rdimm ? `$${rdimm.price.toLocaleString()}` : "---"}
          sub={rdimm ? `${rdimm.changePct > 0 ? "+" : ""}${rdimm.changePct}% WoW · $${rdimm.weeklyLow}-$${rdimm.weeklyHigh}` : ""}
          color="#FF4444"
        />
        <Metric
          label="DDR5 16Gb Chip"
          value={chip ? `$${chip.price}` : "---"}
          sub={chip ? `${chip.changePct > 0 ? "+" : ""}${chip.changePct}% WoW · $${chip.weeklyLow}-$${chip.weeklyHigh}` : ""}
          color="#FFB800"
        />
        <Metric
          label="DDR5 16Gb eTT"
          value={ett ? `$${ett.price}` : "---"}
          sub={ett ? `${ett.changePct > 0 ? "+" : ""}${ett.changePct}% WoW · $${ett.weeklyLow}-$${ett.weeklyHigh}` : ""}
          color="#00D4FF"
        />
      </div>

      {chartData.length > 5 && (
        <div className="bg-bep-card border border-bep-border rounded-md p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono text-bep-muted uppercase tracking-wider">
              DDR5 RDIMM 32GB Spot Price
              {totalChange !== null && (
                <span className="ml-2" style={{ color: totalChange > 0 ? "#FF4444" : "#76B900" }}>
                  {totalChange > 0 ? "+" : ""}{totalChange}% over period
                </span>
              )}
            </div>
            <a href="https://www.ornn.com" target="_blank" rel="noopener noreferrer" className="text-[8px] font-mono text-bep-cyan no-underline hover:underline">Ornn AI</a>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 8 }} interval={Math.floor(chartData.length / 6)} />
              <YAxis tick={{ fill: "#666", fontSize: 8 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 10, fontFamily: "monospace" }}
                formatter={(v) => [`$${Number(v).toLocaleString()}`, "DDR5 RDIMM 32GB"]}
              />
              <Line type="monotone" dataKey="price" stroke="#FF4444" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* All memory types table */}
      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        <div className="grid font-mono text-[9px] text-bep-muted uppercase tracking-wider px-3 py-2 border-b border-bep-border"
          style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 0.8fr" }}>
          <span>Type</span>
          <span className="text-right">Spot</span>
          <span className="text-right">WoW</span>
          <span className="text-right">Low</span>
          <span className="text-right">High</span>
        </div>
        {data.current.map((m, i) => (
          <div key={m.key} className="grid px-3 py-1.5 text-[11px] border-b border-bep-border last:border-0"
            style={{ gridTemplateColumns: "2fr 0.8fr 0.8fr 0.8fr 0.8fr", background: i % 2 ? "#0d0d0d" : "transparent" }}>
            <span className="text-bep-white font-medium">{m.label}</span>
            <span className="text-right font-mono text-bep-white font-semibold">${m.price.toLocaleString()}</span>
            <span className="text-right font-mono font-semibold" style={{ color: m.changePct > 0 ? "#FF4444" : m.changePct < 0 ? "#76B900" : "#666" }}>
              {m.changePct > 0 ? "+" : ""}{m.changePct}%
            </span>
            <span className="text-right font-mono text-bep-dim">${m.weeklyLow}</span>
            <span className="text-right font-mono text-bep-dim">${m.weeklyHigh}</span>
          </div>
        ))}
      </div>

      <InsightBox>
        DDR5 RDIMM 32GB server memory has surged from $380 to $930 since November 2025 — a 145% increase driven by AI server demand outpacing DRAM supply expansion. Every GPU server needs 1-2TB of system memory alongside HBM. As GB300 NVL72 racks deploy at scale, DDR5 module demand will accelerate further. Memory cost is becoming a larger share of total GPU cluster TCO, validating the Memory Wars thesis: the constraint isn&apos;t just GPU silicon, it&apos;s the entire memory supply chain.
      </InsightBox>
    </Section>
  );
}
