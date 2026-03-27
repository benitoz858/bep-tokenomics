"use client";

import { useMemo } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import Section from "./ui/Section";
import { GPU_DISPLAY_NAMES } from "@/lib/calculations";
import type { GPUSummary } from "@/lib/data";

const GPU_COLORS: Record<string, { raw: string; ma: string }> = {
  "nvidia-a100": { raw: "#00D4FF20", ma: "#00D4FF" },
  "nvidia-h100": { raw: "#A855F720", ma: "#A855F7" },
  "nvidia-h200": { raw: "#76B90020", ma: "#76B900" },
  "nvidia-b200": { raw: "#FF444420", ma: "#FF4444" },
  "nvidia-gb200": { raw: "#FFB80020", ma: "#FFB800" },
  "amd-mi300x": { raw: "#EC489920", ma: "#EC4899" },
  "google-tpu-v5e": { raw: "#4285F420", ma: "#4285F4" },
  "google-tpu-v6e": { raw: "#34A85320", ma: "#34A853" },
  "aws-trainium1": { raw: "#FF990020", ma: "#FF9900" },
  "aws-trainium2": { raw: "#FF660020", ma: "#FF6600" },
};

interface HistoryEntry {
  date: string;
  [key: string]: number | string | null;
}

interface Props {
  history: Record<string, GPUSummary[]>;
  mode: "availability" | "price";
}

function movingAverage(data: (number | null)[], window: number): (number | null)[] {
  return data.map((_, i) => {
    const start = Math.max(0, i - window + 1);
    const slice = data.slice(start, i + 1).filter((v): v is number => v !== null);
    if (slice.length < Math.min(3, window)) return null;
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export default function GPUAvailabilityChart({ history, mode }: Props) {
  const { chartData, gpuModels } = useMemo(() => {
    const dates = Object.keys(history).sort();
    if (dates.length === 0) return { chartData: [], gpuModels: [] };

    // Find all GPU models across all dates
    const modelSet = new Set<string>();
    for (const entries of Object.values(history)) {
      for (const entry of entries) {
        modelSet.add(entry.gpuModel);
      }
    }
    const gpuModels = Array.from(modelSet).sort();

    // Build raw time series
    const rawData: HistoryEntry[] = dates.map((date) => {
      const entries = history[date] || [];
      const point: HistoryEntry = { date };
      for (const gpu of gpuModels) {
        const e = entries.find((s) => s.gpuModel === gpu);
        if (mode === "availability") {
          point[gpu] = e?.availabilityPct ?? null;
        } else {
          point[gpu] = e?.spot.median ?? e?.onDemand.median ?? null;
        }
      }
      return point;
    });

    // Compute 7-day moving averages (shorter window since we're daily, not minute)
    const maWindow = Math.min(7, Math.max(1, Math.floor(dates.length / 3)));
    for (const gpu of gpuModels) {
      const values = rawData.map((d) => d[gpu] as number | null);
      const ma = movingAverage(values, maWindow);
      rawData.forEach((d, i) => {
        d[`${gpu}_ma`] = ma[i];
      });
    }

    return { chartData: rawData, gpuModels };
  }, [history, mode]);

  if (chartData.length < 2) {
    return (
      <Section
        title={mode === "availability" ? "GPU Availability Over Time" : "GPU Spot Pricing Over Time"}
        subtitle="Collecting data daily via cron. Chart will appear after 2+ days of data accumulation."
      >
        <div className="bg-bep-card border border-bep-border rounded-md p-8 text-center">
          <div className="text-bep-muted text-sm font-mono mb-2">
            {chartData.length} day{chartData.length !== 1 ? "s" : ""} of data collected
          </div>
          <div className="text-bep-dim text-xs">
            Need 2+ days for trend lines. Run <span className="text-bep-cyan">npm run fetch:gpus</span> daily or wait for GitHub Actions cron.
          </div>
          <div className="text-bep-dim text-xs mt-2">
            For 3Fourteen-style minute-level data, add a <span className="text-bep-amber">GetDeploying API key</span> — they track availability across cloud providers at much higher frequency.
          </div>
        </div>
      </Section>
    );
  }

  const isAvailability = mode === "availability";

  return (
    <Section
      title={isAvailability ? "GPU Availability Over Time" : "GPU Spot Pricing Over Time"}
      subtitle={`${chartData.length} days of data. Faded lines = raw daily readings. Bold dashed = ${Math.min(7, Math.floor(chartData.length / 3))}-day moving average.${isAvailability ? " Lower availability = higher demand = tighter supply constraint." : " Price deflation rate = commoditization speed."}`}
    >
      <div className="bg-bep-card border border-bep-border rounded-md p-4">
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#666", fontSize: 10 }}
              tickFormatter={(v: string) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis
              tick={{ fill: "#666", fontSize: 10 }}
              tickFormatter={(v: number) => isAvailability ? `${v}%` : `$${v.toFixed(1)}`}
              domain={isAvailability ? [0, 100] : ["auto", "auto"]}
            />
            <Tooltip
              contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
              formatter={(value, name) => {
                const v = Number(value);
                const cleanName = String(name).replace("_ma", " (MA)");
                const displayName = GPU_DISPLAY_NAMES[cleanName] || GPU_DISPLAY_NAMES[String(name).replace("_ma", "")] || cleanName;
                return [isAvailability ? `${v.toFixed(0)}%` : `$${v.toFixed(2)}`, displayName];
              }}
              labelFormatter={(label) => `Date: ${label}`}
            />

            {/* Raw data lines (faded) */}
            {gpuModels.map((gpu) => (
              <Line
                key={gpu}
                dataKey={gpu}
                stroke={GPU_COLORS[gpu]?.raw || "#66666640"}
                strokeWidth={1}
                dot={false}
                connectNulls
                name={gpu}
                legendType="none"
              />
            ))}

            {/* Moving average lines (bold, dashed) */}
            {gpuModels.map((gpu) => (
              <Line
                key={`${gpu}_ma`}
                dataKey={`${gpu}_ma`}
                stroke={GPU_COLORS[gpu]?.ma || "#666"}
                strokeWidth={2.5}
                strokeDasharray="8 4"
                dot={false}
                connectNulls
                name={`${gpu}_ma`}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>

        {/* Custom legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 justify-center">
          {gpuModels.map((gpu) => (
            <div key={gpu} className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5">
                <div className="w-4 h-[2px]" style={{ background: GPU_COLORS[gpu]?.raw || "#66666640" }} />
                <div className="w-6 h-[2.5px]" style={{ background: GPU_COLORS[gpu]?.ma || "#666", borderTop: "1.5px dashed transparent" }}>
                  <div className="w-full h-full" style={{ borderTop: `2.5px dashed ${GPU_COLORS[gpu]?.ma || "#666"}` }} />
                </div>
              </div>
              <span className="text-[10px] font-mono" style={{ color: GPU_COLORS[gpu]?.ma || "#666" }}>
                {GPU_DISPLAY_NAMES[gpu] || gpu}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
