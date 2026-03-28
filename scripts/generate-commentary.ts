/**
 * BEP Research — Market Commentary Generator
 *
 * Reads all live data and generates an analyst-style market brief.
 * Run after fetch scripts in the daily cron.
 *
 * Output: data/commentary/latest.json
 */

import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

interface TokenModel {
  model: string;
  modelId: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

interface GPUSummary {
  gpuModel: string;
  spot: { min: number | null; median: number | null; max: number | null; count: number };
  onDemand: { min: number | null; median: number | null; max: number | null; count: number };
  availabilityPct: number;
  totalGpusAvailable: number;
  totalGpusRented: number;
}

interface LLMflation {
  currentIndex: number;
  components: Record<string, number | null>;
}

function gpuName(id: string): string {
  return id.replace("nvidia-", "").replace("amd-", "").toUpperCase();
}

function main() {
  // Load all data
  const tokenData = readJSON<{ models: TokenModel[]; fetchedAt: string }>(dataPath("token-pricing", "current.json"));
  const gpuData = readJSON<{ summaries: GPUSummary[]; fetchedAt: string }>(dataPath("gpu-pricing", "current.json"));
  const llmflation = readJSON<LLMflation>(dataPath("indices", "llmflation.json"));
  const gpuHistory = readJSON<{ entries: Record<string, GPUSummary[]> }>(dataPath("gpu-pricing", "history.json"));
  const tokenHistory = readJSON<{ entries: Record<string, Array<{ modelId: string; outputPerMillion: number }>> }>(dataPath("token-pricing", "history.json"));

  const models = tokenData?.models || [];
  const gpus = (gpuData?.summaries || []).filter(g => g.spot.median || g.onDemand.median);

  const paragraphs: string[] = [];
  const bullets: string[] = [];

  // ── HEADLINE: Market state ──
  const today = todayISO();
  const totalModels = models.length;
  const totalGpuOffers = gpus.reduce((s, g) => s + (g.spot.count || 0), 0);

  if (llmflation) {
    paragraphs.push(
      `The BEP LLMflation Index sits at ${llmflation.currentIndex.toFixed(1)}, down ${(100 - llmflation.currentIndex).toFixed(0)}% from the GPT-4 launch baseline of 100. Frontier inference continues to deflate — but the deflation is uneven. The premium tier is holding pricing power while the commodity floor races toward zero.`
    );
  }

  // ── TOKEN PRICING ANALYSIS ──
  if (models.length > 2) {
    const sorted = [...models].sort((a, b) => b.outputPerMillion - a.outputPerMillion);
    const cheapest = sorted[sorted.length - 1];
    const priciest = sorted[0];
    const spread = Math.round(priciest.outputPerMillion / cheapest.outputPerMillion);

    const openaiModels = models.filter(m => m.provider === "OpenAI");
    const anthropicModels = models.filter(m => m.provider === "Anthropic");
    const deepseekModels = models.filter(m => m.provider === "DeepSeek");

    const openaiFlag = openaiModels.sort((a, b) => b.outputPerMillion - a.outputPerMillion)[0];
    const anthropicFlag = anthropicModels.sort((a, b) => b.outputPerMillion - a.outputPerMillion)[0];
    const cheapestDeepseek = deepseekModels.sort((a, b) => a.outputPerMillion - b.outputPerMillion)[0];

    paragraphs.push(
      `Tracking ${totalModels} frontier models today. The price spread stands at ${spread}x — ${cheapest.model} at $${cheapest.outputPerMillion < 1 ? cheapest.outputPerMillion.toFixed(2) : cheapest.outputPerMillion}/M output versus ${priciest.model} at $${priciest.outputPerMillion}/M. This isn't convergence — it's bifurcation. The market is segmenting into distinct tiers exactly as Jensen mapped at GTC.`
    );

    if (openaiFlag) bullets.push(`OpenAI flagship: ${openaiFlag.model} at $${openaiFlag.outputPerMillion}/M output`);
    if (anthropicFlag) bullets.push(`Anthropic flagship: ${anthropicFlag.model} at $${anthropicFlag.outputPerMillion}/M output`);
    if (cheapestDeepseek) bullets.push(`DeepSeek floor: ${cheapestDeepseek.model} at $${cheapestDeepseek.outputPerMillion < 1 ? cheapestDeepseek.outputPerMillion.toFixed(2) : cheapestDeepseek.outputPerMillion}/M output — ${cheapestDeepseek.outputPerMillion < 1 ? "sub-dollar inference is here" : "aggressive pricing"}`);
  }

  // ── GPU MARKET ANALYSIS ──
  if (gpus.length > 0) {
    const gpuLines: string[] = [];
    let tightestGpu = "";
    let tightestPct = 100;

    for (const gpu of gpus) {
      const name = gpuName(gpu.gpuModel);
      const spot = gpu.spot.median;
      const total = gpu.totalGpusAvailable + gpu.totalGpusRented;

      if (gpu.availabilityPct < tightestPct && total > 0) {
        tightestPct = gpu.availabilityPct;
        tightestGpu = name;
      }

      if (spot && total > 0) {
        gpuLines.push(`${name}: $${spot.toFixed(2)}/hr spot median, ${gpu.availabilityPct}% available (${gpu.totalGpusAvailable}/${total} GPUs)`);
      }
    }

    if (tightestGpu) {
      paragraphs.push(
        `GPU spot market: ${tightestGpu} is the tightest at ${tightestPct}% availability. ${tightestPct < 25 ? "This is a supply constraint signal — demand exceeds deployed capacity on the spot market." : "Supply is adequate but not loose."} ${totalGpuOffers} total offerings tracked across Vast.ai.`
      );
    }

    for (const line of gpuLines) {
      bullets.push(line);
    }

    // Cost-to-produce analysis
    const cheapestGpu = gpus.sort((a, b) => (a.spot.median || 99) - (b.spot.median || 99))[0];
    if (cheapestGpu?.spot.median) {
      const costHr = cheapestGpu.spot.median;
      const name = gpuName(cheapestGpu.gpuModel);
      // Rough Llama 70B throughput estimates
      const throughputGuess: Record<string, number> = { "H100": 95, "H200": 145, "B200": 380 };
      const tok = throughputGuess[name] || 100;
      const costPerM = (costHr / (tok * 3600)) * 1_000_000;

      paragraphs.push(
        `At current spot rates, the cheapest path to token production is ${name} at $${costHr.toFixed(2)}/hr — roughly $${costPerM.toFixed(2)}/M tokens for a 70B model. At Premium tier pricing ($45/M), that's ~${Math.round((1 - costPerM / 45) * 100)}% gross margin. At High tier ($6/M), it's ${costPerM > 6 ? "unprofitable" : "barely break-even"}. The hardware generation you're on determines whether inference is a business or a charity.`
      );
    }
  }

  // ── GPU PRICE HISTORY ──
  if (gpuHistory?.entries) {
    const dates = Object.keys(gpuHistory.entries).sort();
    if (dates.length >= 2) {
      const latest = gpuHistory.entries[dates[dates.length - 1]];
      const prior = gpuHistory.entries[dates[dates.length - 2]];

      for (const gpu of latest) {
        const old = prior?.find(p => p.gpuModel === gpu.gpuModel);
        if (old?.spot.median && gpu.spot.median) {
          const change = ((gpu.spot.median - old.spot.median) / old.spot.median) * 100;
          if (Math.abs(change) > 3) {
            const name = gpuName(gpu.gpuModel);
            bullets.push(`${name} spot ${change > 0 ? "up" : "down"} ${Math.abs(change).toFixed(1)}% day-over-day ($${old.spot.median.toFixed(2)} → $${gpu.spot.median.toFixed(2)})`);
          }
        }
      }
    }
  }

  // ── BOTTOM LINE ──
  paragraphs.push(
    `Bottom line: The token economy continues to bifurcate. Commodity inference deflates toward zero while premium reasoning and agentic workloads command 50-200x premiums. The investment signal is in the spread, not the average. Track which hardware generation can profitably serve which tier — that's where capital allocation decisions live.`
  );

  const commentary = {
    generatedAt: nowISO(),
    date: today,
    title: `Market Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    summary: paragraphs[0],
    paragraphs,
    bullets,
    dataPoints: {
      modelsTracked: totalModels,
      gpuMarketsTracked: gpus.length,
      llmflationIndex: llmflation?.currentIndex || null,
      gpuOffers: totalGpuOffers,
    },
  };

  const outDir = dataPath("commentary");
  writeJSON(dataPath("commentary", "latest.json"), commentary);
  console.log(`Commentary generated: ${paragraphs.length} paragraphs, ${bullets.length} bullets`);
}

main();
