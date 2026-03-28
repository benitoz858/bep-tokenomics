"use client";

import { useMemo } from "react";
import { costPerMillionFromGPU, inferenceMargin, GPU_DISPLAY_NAMES } from "@/lib/calculations";
import type { TokenPriceModel, GPUSummary, GPUThroughput } from "@/lib/data";

interface Props {
  tokenModels: TokenPriceModel[];
  gpuSummaries: GPUSummary[];
  gpuThroughput: Record<string, GPUThroughput>;
  llmflationIndex?: number;
}

interface Insight {
  tag: string;
  tagColor: string;
  headline: string;
  detail: string;
  severity: "profit" | "warning" | "danger" | "info";
}

const SEVERITY_STYLES: Record<string, { border: string; bg: string; tagBg: string }> = {
  profit: { border: "#76B90040", bg: "#76B90008", tagBg: "#76B900" },
  warning: { border: "#FFB80040", bg: "#FFB80008", tagBg: "#FFB800" },
  danger: { border: "#FF444440", bg: "#FF444408", tagBg: "#FF4444" },
  info: { border: "#00D4FF40", bg: "#00D4FF08", tagBg: "#00D4FF" },
};

export default function ActionableInsights({ tokenModels, gpuSummaries, gpuThroughput, llmflationIndex }: Props) {
  const insights = useMemo(() => {
    const results: Insight[] = [];

    // ── MARGIN OPPORTUNITIES ──
    // Find the best margin opportunity: cheapest GPU + highest throughput model + Premium tier
    const gpusWithThroughput = gpuSummaries.filter(g => {
      const tp = gpuThroughput[g.gpuModel];
      return tp && (g.spot.median || g.onDemand.median);
    });

    for (const gpu of gpusWithThroughput) {
      const tp = gpuThroughput[gpu.gpuModel];
      if (!tp) continue;
      const rawCostPerHr = gpu.spot.median || gpu.onDemand.median || 0;
      const costPerHr = rawCostPerHr * 1.25; // TCO-adjusted: +25% for storage, reliability, support
      const gpuName = GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel;

      // Check llama-70b gpuOnly throughput
      const llama = tp.profiles?.["llama-70b"];
      const llamaTok = llama?.gpuOnly;
      if (llamaTok && rawCostPerHr > 0) {
        const costPerM = costPerMillionFromGPU(costPerHr, llamaTok);
        const marginPremium = inferenceMargin(45, costPerM);
        const marginHigh = inferenceMargin(6, costPerM);

        if (marginPremium > 85) {
          results.push({
            tag: "HIGH MARGIN",
            tagColor: "#76B900",
            headline: `${gpuName} at Premium tier = ${marginPremium.toFixed(0)}% gross margin`,
            detail: `Spot $${costPerHr.toFixed(2)}/hr → $${costPerM.toFixed(2)}/M token cost → sell at $45/M. Only need ${(100 - marginPremium).toFixed(0)}% utilization to break even.`,
            severity: "profit",
          });
        }

        if (marginHigh < 0) {
          results.push({
            tag: "MONEY LOSER",
            tagColor: "#FF4444",
            headline: `${gpuName} at High tier ($6/M) = ${marginHigh.toFixed(0)}% margin — you lose money`,
            detail: `Token production cost is $${costPerM.toFixed(2)}/M but sell price is only $6/M. Need Premium ($45/M) or Ultra ($150/M) tier to be profitable.`,
            severity: "danger",
          });
        }
      }

      // Check LPX boost
      const llamaLpx = llama?.withLPX;
      if (llamaLpx && llamaTok && costPerHr > 0) {
        const costGpuOnly = costPerMillionFromGPU(costPerHr, llamaTok);
        const costWithLpx = costPerMillionFromGPU(costPerHr + 2.50, llamaLpx);
        const savings = ((1 - costWithLpx / costGpuOnly) * 100);
        if (savings > 30) {
          results.push({
            tag: "LPX UNLOCK",
            tagColor: "#76B900",
            headline: `Adding LPX to ${gpuName} cuts token cost ${savings.toFixed(0)}%`,
            detail: `GPU-only: $${costGpuOnly.toFixed(2)}/M at ${llamaTok} tok/s → GPU+LPX: $${costWithLpx.toFixed(2)}/M at ${llamaLpx} tok/s. Throughput ${(llamaLpx/llamaTok).toFixed(1)}x, cost ${savings.toFixed(0)}% lower despite $2.50/hr LPX add.`,
            severity: "profit",
          });
        }
      }
    }

    // ── SUPPLY CONSTRAINT SIGNALS ──
    for (const gpu of gpuSummaries) {
      if (gpu.totalGpusAvailable + gpu.totalGpusRented <= 0) continue;
      const gpuName = GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel;
      const total = gpu.totalGpusAvailable + gpu.totalGpusRented;

      if (gpu.availabilityPct < 20) {
        results.push({
          tag: "SUPPLY TIGHT",
          tagColor: "#FF4444",
          headline: `${gpuName}: only ${gpu.availabilityPct}% available — ${gpu.totalGpusAvailable} of ${total} GPUs free`,
          detail: `${100 - gpu.availabilityPct}% utilization on spot market. High demand signal. Spot prices may spike. Consider reserved commitments.`,
          severity: "danger",
        });
      } else if (gpu.availabilityPct > 60) {
        results.push({
          tag: "SURPLUS",
          tagColor: "#00D4FF",
          headline: `${gpuName}: ${gpu.availabilityPct}% available — oversupply on spot market`,
          detail: `${gpu.totalGpusAvailable} of ${total} GPUs idle. Spot prices likely to drop. Good time to run benchmarks or experiments.`,
          severity: "info",
        });
      }
    }

    // ── TOKEN PRICING SIGNALS ──
    if (tokenModels.length > 0) {
      const cheapest = tokenModels.reduce((min, m) => m.outputPerMillion < min.outputPerMillion ? m : min);
      const priciest = tokenModels.reduce((max, m) => m.outputPerMillion > max.outputPerMillion ? m : max);
      const spread = priciest.outputPerMillion / cheapest.outputPerMillion;

      results.push({
        tag: "SPREAD",
        tagColor: "#A855F7",
        headline: `${Math.round(spread)}x price spread: ${cheapest.model} ($${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M) vs ${priciest.model} ($${priciest.outputPerMillion}/M)`,
        detail: `The market is bifurcating, not commoditizing. Premium reasoning models command ${Math.round(spread)}x the price of open-source inference. This spread is the investment thesis — it validates NVIDIA's five-tier model.`,
        severity: "info",
      });

      // Find models where selling price < TCO-adjusted production cost on cheapest GPU
      const cheapestGpu = gpusWithThroughput.sort((a, b) => (a.spot.median || 99) - (b.spot.median || 99))[0];
      if (cheapestGpu) {
        const tp = gpuThroughput[cheapestGpu.gpuModel];
        const llama = tp?.profiles?.["llama-70b"];
        if (llama?.gpuOnly) {
          const tcoCostPerHr = (cheapestGpu.spot.median || 0) * 1.25;
          const costPerM = costPerMillionFromGPU(tcoCostPerHr, llama.gpuOnly);
          const underpriced = tokenModels.filter(m => m.outputPerMillion > 0 && m.outputPerMillion < costPerM);
          if (underpriced.length > 0) {
            results.push({
              tag: "BELOW COST",
              tagColor: "#FF4444",
              headline: `${underpriced.length} model${underpriced.length > 1 ? "s" : ""} priced below TCO-adjusted production cost`,
              detail: `${underpriced.map(m => m.model).join(", ")} sell output below the $${costPerM.toFixed(2)}/M true cost (TCO-adjusted) on ${GPU_DISPLAY_NAMES[cheapestGpu.gpuModel]}. These providers are subsidizing every token served.`,
              severity: "warning",
            });
          }
        }
      }
    }

    // ── LLMFLATION ──
    if (llmflationIndex) {
      results.push({
        tag: "DEFLATION",
        tagColor: "#76B900",
        headline: `LLMflation Index at ${llmflationIndex.toFixed(1)} — frontier inference ${(100 - llmflationIndex).toFixed(0)}% cheaper than GPT-4 launch`,
        detail: `Token prices deflating ~10x/year. But Jevons Paradox: cheaper tokens create more demand, not less. Infrastructure spend grows because tokens-per-query is exploding faster than cost-per-token falls.`,
        severity: "info",
      });
    }

    return results;
  }, [tokenModels, gpuSummaries, gpuThroughput, llmflationIndex]);

  if (insights.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[11px] font-mono text-bep-muted uppercase tracking-widest">Key Insights</span>
        <span className="text-[10px] font-mono text-bep-dim">· computed from live data</span>
      </div>
      <div className="space-y-2">
        {insights.map((insight, i) => {
          const styles = SEVERITY_STYLES[insight.severity];
          return (
            <div key={i} className="rounded-md px-4 py-3 border"
              style={{ background: styles.bg, borderColor: styles.border }}>
              <div className="flex items-start gap-3">
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                  style={{ background: insight.tagColor + "20", color: insight.tagColor, border: `1px solid ${insight.tagColor}40` }}>
                  {insight.tag}
                </span>
                <div className="min-w-0">
                  <div className="text-[13px] text-bep-white font-semibold leading-snug">{insight.headline}</div>
                  <div className="text-[11px] text-bep-dim mt-1 leading-relaxed">{insight.detail}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
