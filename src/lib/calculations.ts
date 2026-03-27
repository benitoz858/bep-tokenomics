// Derived metrics and calculations

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
