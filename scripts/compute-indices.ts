import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

// ── LLMflation Index ──
// Weighted basket of frontier model output prices
// Base: March 2023 = 100 (GPT-4 launch at $60/M output)
const BASE_PRICE = 60; // $60/M output tokens, March 2023
const WEIGHTS: Record<string, number> = {
  "OpenAI": 0.30,
  "Anthropic": 0.25,
  "Google": 0.20,
  "DeepSeek": 0.15,
  "open-source": 0.10,
};

// Map providers to their "flagship" model identifier patterns
const FLAGSHIP_PATTERNS: Record<string, string[]> = {
  "OpenAI": ["gpt-5.4", "gpt-5.2", "gpt-5"],
  "Anthropic": ["claude-opus", "claude-sonnet"],
  "Google": ["gemini-2.5-pro", "gemini-3-pro"],
  "DeepSeek": ["deepseek-v3", "deepseek-r1"],
};

interface TokenPriceEntry {
  modelId: string;
  provider: string;
  outputPerMillion: number;
}

interface GPUSummary {
  gpuModel: string;
  onDemand: { median: number | null };
  spot: { median: number | null };
}

interface InferenceMargin {
  gpuModel: string;
  gpuCostPerHour: number;
  tokPerSecPerGpu: number;
  costPerMillionTokens: number;
  margins: Array<{
    tier: string;
    revenuePerMillion: number;
    margin: number;
    breakEvenUtilization: number;
  }>;
}

function findFlagship(models: TokenPriceEntry[], provider: string): number | null {
  const patterns = FLAGSHIP_PATTERNS[provider];
  if (!patterns) return null;

  for (const pattern of patterns) {
    const model = models.find((m) => m.modelId.toLowerCase().includes(pattern));
    if (model) return model.outputPerMillion;
  }
  return null;
}

function computeLLMflation(models: TokenPriceEntry[]): { index: number; components: Record<string, number | null> } {
  const components: Record<string, number | null> = {};
  let weightedPrice = 0;
  let totalWeight = 0;

  for (const [provider, weight] of Object.entries(WEIGHTS)) {
    if (provider === "open-source") {
      // Use cheapest model as proxy
      const cheapest = [...models].sort((a, b) => a.outputPerMillion - b.outputPerMillion)[0];
      components[provider] = cheapest?.outputPerMillion || null;
      if (cheapest) {
        weightedPrice += cheapest.outputPerMillion * weight;
        totalWeight += weight;
      }
    } else {
      const price = findFlagship(models, provider);
      components[provider] = price;
      if (price !== null) {
        weightedPrice += price * weight;
        totalWeight += weight;
      }
    }
  }

  const avgPrice = totalWeight > 0 ? weightedPrice / totalWeight : 0;
  const index = (avgPrice / BASE_PRICE) * 100;

  return { index: Math.round(index * 100) / 100, components };
}

function computeInferenceMargins(
  gpuPricing: GPUSummary[],
  throughput: Record<string, { tokPerSecPerGpu: number }>
): InferenceMargin[] {
  const tiers = [
    { tier: "Free", price: 0 },
    { tier: "Medium", price: 3 },
    { tier: "High", price: 6 },
    { tier: "Premium", price: 45 },
    { tier: "Ultra", price: 150 },
  ];

  const margins: InferenceMargin[] = [];

  for (const gpu of gpuPricing) {
    const tp = throughput[gpu.gpuModel];
    if (!tp) continue;

    const costPerHour = gpu.onDemand.median || gpu.spot.median || 0;
    if (costPerHour === 0) continue;

    const tokPerSec = tp.tokPerSecPerGpu;
    const tokPerHour = tokPerSec * 3600;
    const costPerMillionTokens = (costPerHour / tokPerHour) * 1_000_000;

    const tierMargins = tiers.map((t) => ({
      tier: t.tier,
      revenuePerMillion: t.price,
      margin: t.price > 0 ? Math.round(((t.price - costPerMillionTokens) / t.price) * 10000) / 100 : 0,
      breakEvenUtilization: t.price > 0 ? Math.round((costPerMillionTokens / t.price) * 10000) / 100 : 100,
    }));

    margins.push({
      gpuModel: gpu.gpuModel,
      gpuCostPerHour: costPerHour,
      tokPerSecPerGpu: tokPerSec,
      costPerMillionTokens: Math.round(costPerMillionTokens * 100) / 100,
      margins: tierMargins,
    });
  }

  return margins;
}

async function main() {
  console.log("Computing indices...\n");

  // Read token pricing
  const tokenData = readJSON<{ models: TokenPriceEntry[] }>(dataPath("token-pricing", "current.json"));
  const models = tokenData?.models || [];

  // Read GPU pricing
  const gpuData = readJSON<{ summaries: GPUSummary[] }>(dataPath("gpu-pricing", "current.json"));
  const gpuSummaries = gpuData?.summaries || [];

  // Read throughput estimates (use llama-70b gpuOnly as reference for index computation)
  const throughputRaw = readJSON<{ gpus: Record<string, { profiles: Record<string, { gpuOnly: number | null }> }> }>(dataPath("static", "gpu-throughput.json"));
  const throughput: Record<string, { tokPerSecPerGpu: number }> = {};
  if (throughputRaw?.gpus) {
    for (const [gpu, data] of Object.entries(throughputRaw.gpus)) {
      const llama = data.profiles["llama-70b"];
      if (llama?.gpuOnly) {
        throughput[gpu] = { tokPerSecPerGpu: llama.gpuOnly };
      }
    }
  }

  // 1. LLMflation Index
  if (models.length) {
    const llmflation = computeLLMflation(models);
    console.log(`LLMflation Index: ${llmflation.index} (base 100 = $60/M in Mar 2023)`);
    for (const [k, v] of Object.entries(llmflation.components)) {
      console.log(`  ${k}: $${v?.toFixed(2) || "N/A"}/M`);
    }
    writeJSON(dataPath("indices", "llmflation.json"), {
      computedAt: nowISO(),
      date: todayISO(),
      basePricePerMillion: BASE_PRICE,
      baseDate: "2023-03-14",
      currentIndex: llmflation.index,
      components: llmflation.components,
      weights: WEIGHTS,
    });
  } else {
    console.log("No token pricing data — skipping LLMflation.");
  }

  // 2. Inference Margins
  if (gpuSummaries.length && Object.keys(throughput).length) {
    const margins = computeInferenceMargins(gpuSummaries, throughput);
    console.log(`\nInference margins computed for ${margins.length} GPUs:`);
    for (const m of margins) {
      console.log(`  ${m.gpuModel}: cost $${m.costPerMillionTokens.toFixed(2)}/M tokens @ $${m.gpuCostPerHour.toFixed(2)}/hr`);
      for (const t of m.margins) {
        if (t.revenuePerMillion > 0) {
          console.log(`    ${t.tier}: ${t.margin}% margin (${t.breakEvenUtilization}% utilization to break even)`);
        }
      }
    }
    writeJSON(dataPath("indices", "inference-margin.json"), {
      computedAt: nowISO(),
      date: todayISO(),
      margins,
    });
  } else {
    console.log("No GPU pricing or throughput data — skipping inference margins.");
  }

  // 3. GPU Price Deflation (needs historical data)
  const gpuHistory = readJSON<{ entries: Record<string, GPUSummary[]> }>(dataPath("gpu-pricing", "history.json"));
  if (gpuHistory?.entries) {
    const dates = Object.keys(gpuHistory.entries).sort();
    if (dates.length >= 2) {
      const latest = gpuHistory.entries[dates[dates.length - 1]];
      const prior = gpuHistory.entries[dates[dates.length - 2]];
      console.log("\nGPU Price Changes (vs prior snapshot):");
      for (const gpu of latest) {
        const old = prior.find((p: GPUSummary) => p.gpuModel === gpu.gpuModel);
        if (old?.onDemand.median && gpu.onDemand.median) {
          const change = ((gpu.onDemand.median - old.onDemand.median) / old.onDemand.median) * 100;
          console.log(`  ${gpu.gpuModel}: ${change > 0 ? "+" : ""}${change.toFixed(1)}% WoW`);
        }
      }
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
