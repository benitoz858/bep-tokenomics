"use client";

import type { TokenPriceModel, GPUSummary } from "@/lib/data";

interface Props {
  tokenModels: TokenPriceModel[];
  gpuSummaries: GPUSummary[];
  llmflationIndex?: number;
  fetchedAt: string;
}

interface Signal {
  type: "price-drop" | "price-hike" | "availability" | "index" | "new-model" | "supply";
  severity: "high" | "medium" | "low";
  text: string;
  detail: string;
  color: string;
}

export default function SignalFeed({ tokenModels, gpuSummaries, llmflationIndex, fetchedAt }: Props) {
  const signals: Signal[] = [];

  // Token pricing signals
  const cheapestOutput = tokenModels.length
    ? tokenModels.reduce((min, m) => m.outputPerMillion < min.outputPerMillion ? m : min)
    : null;
  const mostExpensiveOutput = tokenModels.length
    ? tokenModels.reduce((max, m) => m.outputPerMillion > max.outputPerMillion ? m : max)
    : null;

  if (cheapestOutput && mostExpensiveOutput) {
    const spread = Math.round(mostExpensiveOutput.outputPerMillion / cheapestOutput.outputPerMillion);
    signals.push({
      type: "price-drop",
      severity: "high",
      text: `${spread}x spread between cheapest and premium inference`,
      detail: `${cheapestOutput.model} at $${cheapestOutput.outputPerMillion < 1 ? cheapestOutput.outputPerMillion.toFixed(2) : cheapestOutput.outputPerMillion}/M → ${mostExpensiveOutput.model} at $${mostExpensiveOutput.outputPerMillion}/M`,
      color: "#00D4FF",
    });
  }

  // LLMflation signal
  if (llmflationIndex) {
    signals.push({
      type: "index",
      severity: llmflationIndex < 10 ? "high" : "medium",
      text: `LLMflation Index: ${llmflationIndex.toFixed(1)} (base 100 = GPT-4 launch)`,
      detail: `Frontier token prices have fallen ${(100 - llmflationIndex).toFixed(0)}% from March 2023 baseline`,
      color: "#76B900",
    });
  }

  // GPU availability signals
  for (const gpu of gpuSummaries) {
    if (gpu.totalGpusAvailable + gpu.totalGpusRented > 0 && gpu.availabilityPct <= 25) {
      const name = gpu.gpuModel.replace("nvidia-", "").replace("amd-", "").toUpperCase();
      signals.push({
        type: "availability",
        severity: gpu.availabilityPct < 15 ? "high" : "medium",
        text: `${name} supply tight: ${gpu.availabilityPct}% available`,
        detail: `${gpu.totalGpusAvailable} free / ${gpu.totalGpusAvailable + gpu.totalGpusRented} total GPUs tracked on spot market`,
        color: gpu.availabilityPct < 15 ? "#FF4444" : "#FFB800",
      });
    }
  }

  // GPU spot price signals
  for (const gpu of gpuSummaries) {
    const spotMedian = gpu.spot.median;
    if (spotMedian && gpu.gpuModel.startsWith("nvidia-")) {
      const name = gpu.gpuModel.replace("nvidia-", "").toUpperCase();
      signals.push({
        type: "price-drop",
        severity: "low",
        text: `${name} spot: $${spotMedian.toFixed(2)}/GPU-hr`,
        detail: `Range $${gpu.spot.min?.toFixed(2) || "?"} – $${gpu.spot.max?.toFixed(2) || "?"} across ${gpu.spot.count} offerings`,
        color: "#FFB800",
      });
    }
  }

  const date = new Date(fetchedAt);
  const timeAgo = Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60));
  const freshness = timeAgo < 1 ? "just now" : timeAgo < 24 ? `${timeAgo}h ago` : `${Math.round(timeAgo / 24)}d ago`;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bep-green animate-pulse" />
          <span className="text-[11px] font-mono text-bep-muted uppercase tracking-widest">Live Signals</span>
        </div>
        <span className="text-[10px] font-mono text-bep-dim">Updated {freshness} · {tokenModels.length} models · {gpuSummaries.filter(g => g.totalGpusAvailable + g.totalGpusRented > 0).length} GPU markets</span>
      </div>
      <div className="space-y-1.5">
        {signals.map((s, i) => (
          <div key={i} className="flex items-start gap-3 bg-bep-card border border-bep-border rounded px-3 py-2">
            <div className="w-1 h-8 rounded-full flex-shrink-0 mt-0.5" style={{ background: s.color, opacity: s.severity === "high" ? 1 : s.severity === "medium" ? 0.6 : 0.3 }} />
            <div className="min-w-0">
              <div className="text-xs text-bep-white font-medium">{s.text}</div>
              <div className="text-[10px] text-bep-dim font-mono">{s.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
