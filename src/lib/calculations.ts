// Derived metrics and calculations

import type { TokenPriceModel, TokenPricingHistory } from "./data";

// ── LLMflation index reconstruction ──
// Same logic as scripts/compute-indices.ts but era-aware so it works for historical snapshots too.
// Listed in priority order: newest pattern wins at "today," older patterns still match historical entries.
export const LLMFLATION_WEIGHTS = {
  OpenAI: 0.30,
  Anthropic: 0.25,
  Google: 0.20,
  DeepSeek: 0.15,
  "open-source": 0.10,
} as const;

const FLAGSHIP_PATTERNS: Record<string, string[]> = {
  OpenAI: ["gpt-5.4", "gpt-5.2", "gpt-5", "gpt-4.5", "gpt-4o", "gpt-4-turbo", "gpt-4"],
  Anthropic: ["claude-opus", "claude-sonnet", "claude-3"],
  Google: ["gemini-2.5-pro", "gemini-3-pro", "gemini-2.0-pro", "gemini-1.5-pro", "gemini-pro"],
  DeepSeek: ["deepseek-v3", "deepseek-r1", "deepseek-v2", "deepseek-chat"],
};

const PROVIDER_PREFIX: Record<string, string> = {
  "openai/": "OpenAI",
  "anthropic/": "Anthropic",
  "google/": "Google",
  "deepseek/": "DeepSeek",
};

function providerOf(modelId: string): string | null {
  for (const [prefix, provider] of Object.entries(PROVIDER_PREFIX)) {
    if (modelId.toLowerCase().startsWith(prefix)) return provider;
  }
  return null;
}

function flagshipPrice(entries: Array<{ modelId: string; outputPerMillion: number }>, provider: string): number | null {
  const patterns = FLAGSHIP_PATTERNS[provider];
  if (!patterns) return null;
  for (const pattern of patterns) {
    const match = entries.find((e) => e.modelId.toLowerCase().includes(pattern));
    if (match) return match.outputPerMillion;
  }
  return null;
}

export function computeLLMflationBasket(
  entries: Array<{ modelId: string; outputPerMillion: number }>,
): { basketPerM: number; index: number; components: Record<string, number | null> } {
  const components: Record<string, number | null> = {};
  let weightedTotal = 0;
  let totalWeight = 0;

  for (const [provider, weight] of Object.entries(LLMFLATION_WEIGHTS)) {
    if (provider === "open-source") {
      // Cheapest non-zero output (excluding frontier providers) is the OSS proxy.
      const oss = entries.filter((e) => !providerOf(e.modelId) && e.outputPerMillion > 0);
      if (oss.length) {
        const min = Math.min(...oss.map((r) => r.outputPerMillion));
        components[provider] = min;
        weightedTotal += min * weight;
        totalWeight += weight;
      } else {
        components[provider] = null;
      }
    } else {
      const price = flagshipPrice(entries, provider);
      components[provider] = price;
      if (price !== null) {
        weightedTotal += price * weight;
        totalWeight += weight;
      }
    }
  }

  const basket = totalWeight > 0 ? weightedTotal / totalWeight : 0;
  return {
    basketPerM: basket,
    index: (basket / 60) * 100,
    components,
  };
}

/**
 * Pick quarterly anchors from a token-pricing history file and compute the LLMflation
 * basket at each anchor. This gives a real, data-derived back-test rather than synthesized values.
 */
export function quarterlyLLMflationSeries(history: TokenPricingHistory): Array<{
  quarter: string;
  date: string;
  basketPerM: number;
  index: number;
}> {
  const dates = Object.keys(history.entries).sort();
  if (!dates.length) return [];

  const startDate = new Date(dates[0]);
  const endDate = new Date(dates[dates.length - 1]);

  // Generate quarter labels from start to end
  const series: Array<{ quarter: string; date: string; basketPerM: number; index: number }> = [];
  const seen = new Set<string>();

  // For each quarter from start to end, find nearest history entry
  const cursor = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3, 1);
  const endCursor = new Date(endDate.getFullYear(), Math.floor(endDate.getMonth() / 3) * 3 + 3, 1);
  while (cursor < endCursor) {
    const q = Math.floor(cursor.getMonth() / 3) + 1;
    const label = `Q${q} ${cursor.getFullYear()}`;
    // Pick the snapshot closest to the MIDPOINT of the quarter
    const mid = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 15);
    const closest = dates.reduce<{ date: string; diff: number } | null>((best, d) => {
      const diff = Math.abs(new Date(d).getTime() - mid.getTime());
      if (best === null || diff < best.diff) return { date: d, diff };
      return best;
    }, null);
    if (closest && !seen.has(label)) {
      const entries = history.entries[closest.date];
      const { basketPerM, index } = computeLLMflationBasket(entries);
      if (basketPerM > 0) {
        series.push({ quarter: label, date: closest.date, basketPerM, index });
        seen.add(label);
      }
    }
    cursor.setMonth(cursor.getMonth() + 3);
  }

  return series;
}

// ── Platform token-margin derivation ──
// Each platform declares a modelMix; we compute blended $/M output from live token-pricing data
// instead of hardcoded constants. Proprietary models use a stated marginal cost (no API markup).

export interface ModelMixEntry {
  modelId?: string;
  proprietary?: string;
  weight: number;
  role?: string;
  proprietaryCostPerM?: number;
  internalDiscount?: number; // 0..1, fraction subtracted from API list (e.g., 0.5 = pay 50% of API)
}

export interface BlendedCostBreakdown {
  costPerM: number;
  details: Array<{
    label: string;
    weight: number;
    rate: number;
    contribution: number;
    source: "live" | "proprietary" | "fallback";
  }>;
  missingModels: string[];
}

/**
 * Compute blended $/M for a platform's model mix using LIVE token-pricing data.
 * Per-token rate is an input/output-weighted blend (default 70% input / 30% output) — real
 * enterprise workloads are input-heavy (system prompt + RAG context + history dominate),
 * and an output-only blend systematically understates cost. Pass `inputWeight` to override
 * per platform (e.g., 0.85 for Agentforce / Notion where context dominates).
 * Falls back to fallbackRate for any modelId we can't resolve (so the dashboard never breaks).
 */
export function blendedTokenCostFromMix(
  mix: ModelMixEntry[],
  liveModels: TokenPriceModel[],
  fallbackRate = 5,
  inputWeight = 0.7,
): BlendedCostBreakdown {
  const details: BlendedCostBreakdown["details"] = [];
  const missing: string[] = [];
  let total = 0;
  const outputWeight = 1 - inputWeight;

  for (const entry of mix) {
    if (entry.proprietary) {
      const rate = entry.proprietaryCostPerM ?? 0.50;
      const contribution = entry.weight * rate;
      total += contribution;
      details.push({
        label: entry.proprietary,
        weight: entry.weight,
        rate,
        contribution,
        source: "proprietary",
      });
      continue;
    }
    if (!entry.modelId) continue;

    // Match by exact modelId (case-insensitive). Prefer OpenRouter (default), fall back to any.
    const target = entry.modelId.toLowerCase();
    const live =
      liveModels.find((m) => m.modelId.toLowerCase() === target && !m.source) ||
      liveModels.find((m) => m.modelId.toLowerCase() === target);

    let rate: number;
    let source: "live" | "fallback";
    if (live) {
      // Input-weighted blend. If input price is missing/zero in the live feed, fall back to
      // output-only rather than producing a misleadingly cheap rate.
      rate = live.inputPerMillion > 0
        ? inputWeight * live.inputPerMillion + outputWeight * live.outputPerMillion
        : live.outputPerMillion;
      source = "live";
    } else {
      rate = fallbackRate;
      source = "fallback";
      missing.push(entry.modelId);
    }

    if (entry.internalDiscount && entry.internalDiscount > 0 && entry.internalDiscount < 1) {
      rate = rate * (1 - entry.internalDiscount);
    }

    const contribution = entry.weight * rate;
    total += contribution;
    details.push({
      label: entry.modelId,
      weight: entry.weight,
      rate,
      contribution,
      source,
    });
  }

  return {
    costPerM: total,
    details,
    missingModels: missing,
  };
}

/**
 * Given a platform's tier + customer pricing + blended token cost + token assumptions,
 * compute the per-unit cost the platform incurs and the token-margin %.
 *
 * For consumption-credit middlemen (Snowflake Cortex, Databricks Mosaic), the platform
 * isn't selling tokens at a 99% markup — it's marking up the wholesale model rate and
 * passing the rest through to the model provider. Pass `markupRate` (e.g., 2.0 = 2x
 * markup over wholesale) and we compute margin = (markupRate - 1) / markupRate.
 *
 * For per-engagement (Palantir) the token cost isn't the binding cost — return null.
 */
export function platformTokenMargin(params: {
  pricingModel: string;
  customerPrice: number;
  blendedCostPerM: number;
  tokensPerInteraction: number | null;
  interactionsPerUserPerDay?: number | null;
  markupRate?: number | null;
}): { costPerUnit: number | null; marginPct: number | null; marginPerUnit: number | null } {
  const { pricingModel, customerPrice, blendedCostPerM, tokensPerInteraction, interactionsPerUserPerDay, markupRate } = params;

  if (pricingModel === "per-engagement") {
    return { costPerUnit: null, marginPct: null, marginPerUnit: null };
  }

  // Consumption-credit middleman: platform's margin is the markup over wholesale,
  // NOT (credit price − wholesale cost). The customer effectively pays the wholesale
  // rate × markup; the rest is passed through to the model provider.
  if (pricingModel === "consumption-credits") {
    if (!markupRate || markupRate <= 1) {
      return { costPerUnit: null, marginPct: null, marginPerUnit: null };
    }
    // Pure middleman math: revenue per unit token = markupRate × wholesale.
    // Platform pays wholesale; keeps (markupRate − 1) × wholesale.
    // Margin% = (markupRate − 1) / markupRate.
    const marginPct = ((markupRate - 1) / markupRate) * 100;
    // Express cost-per-unit as the customer-facing credit price minus the platform's take.
    const platformTake = customerPrice * (marginPct / 100);
    const costPerUnit = customerPrice - platformTake;
    return { costPerUnit, marginPct, marginPerUnit: platformTake };
  }

  if (tokensPerInteraction === null) {
    return { costPerUnit: null, marginPct: null, marginPerUnit: null };
  }

  let costPerUnit: number;

  switch (pricingModel) {
    case "per-conversation":
    case "per-resolution":
    case "per-credit":
    case "per-ai-unit":
      costPerUnit = (tokensPerInteraction / 1_000_000) * blendedCostPerM;
      break;
    case "per-user-month": {
      const interactionsPerMonth = (interactionsPerUserPerDay ?? 0) * 22; // working days
      costPerUnit = (interactionsPerMonth * tokensPerInteraction / 1_000_000) * blendedCostPerM;
      break;
    }
    default:
      costPerUnit = (tokensPerInteraction / 1_000_000) * blendedCostPerM;
  }

  const marginPerUnit = customerPrice - costPerUnit;
  const marginPct = customerPrice > 0 ? (marginPerUnit / customerPrice) * 100 : null;
  return { costPerUnit, marginPct, marginPerUnit };
}

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined) return "N/A";
  if (value >= 100) return `$${value.toFixed(0)}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(4)}`;
}

export function formatPriceMillion(value: number): string {
  return `${formatPrice(value)}/M`;
}

export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

export function spreadRatio(high: number, low: number): number {
  if (low === 0) return 0;
  return high / low;
}

export function inferenceMargin(revenuePerMillion: number, costPerMillion: number): number {
  if (revenuePerMillion === 0) return 0;
  return ((revenuePerMillion - costPerMillion) / revenuePerMillion) * 100;
}

export function breakEvenUtilization(revenuePerMillion: number, costPerMillion: number): number {
  if (revenuePerMillion === 0) return 100;
  return (costPerMillion / revenuePerMillion) * 100;
}

export function costPerMillionFromGPU(gpuCostPerHour: number, tokPerSecPerGpu: number): number {
  const tokPerHour = tokPerSecPerGpu * 3600;
  if (tokPerHour === 0) return 0;
  return (gpuCostPerHour / tokPerHour) * 1_000_000;
}

// Provider color mapping
export const PROVIDER_COLORS: Record<string, string> = {
  OpenAI: "#76B900",
  Anthropic: "#00D4FF",
  Google: "#FFB800",
  DeepSeek: "#FF4444",
  xAI: "#A855F7",
  Meta: "#EC4899",
  Mistral: "#666666",
};

// GPU display names
export const GPU_DISPLAY_NAMES: Record<string, string> = {
  "nvidia-a100": "A100",
  "nvidia-h100": "H100",
  "nvidia-h200": "H200",
  "nvidia-b200": "B200",
  "nvidia-gb200": "GB200 NVL72",
  "amd-mi300x": "MI300X",
  "amd-mi355x": "MI355X",
  "google-tpu-v5e": "TPU v5e",
  "google-tpu-v6e": "TPU v6e (Trillium)",
  "aws-trainium1": "Trainium 1",
  "aws-trainium2": "Trainium 2",
};

// Tier color mapping
export const TIER_COLORS: Record<string, string> = {
  Free: "#444444",
  Medium: "#FFB800",
  High: "#00D4FF",
  Premium: "#76B900",
  Ultra: "#FFD700",
};
