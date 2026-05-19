// Derived metrics and calculations

import type { TokenPriceModel } from "./data";

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
 * Compute blended output $/M for a platform's model mix using LIVE token-pricing data.
 * Falls back to fallbackRate for any modelId we can't resolve (so the dashboard never breaks).
 */
export function blendedTokenCostFromMix(
  mix: ModelMixEntry[],
  liveModels: TokenPriceModel[],
  fallbackRate = 5,
): BlendedCostBreakdown {
  const details: BlendedCostBreakdown["details"] = [];
  const missing: string[] = [];
  let total = 0;

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
      rate = live.outputPerMillion;
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
 */
export function platformTokenMargin(params: {
  pricingModel: string;
  customerPrice: number;
  blendedCostPerM: number;
  tokensPerInteraction: number | null;
  interactionsPerUserPerDay?: number | null;
}): { costPerUnit: number | null; marginPct: number | null; marginPerUnit: number | null } {
  const { pricingModel, customerPrice, blendedCostPerM, tokensPerInteraction, interactionsPerUserPerDay } = params;

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
    case "consumption-credits":
      // 1 credit corresponds roughly to one interaction worth of compute + model markup
      costPerUnit = (tokensPerInteraction / 1_000_000) * blendedCostPerM;
      break;
    case "per-engagement":
      // engagement model — token cost is not the binding cost (e.g., Palantir AIP)
      return { costPerUnit: null, marginPct: null, marginPerUnit: null };
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
