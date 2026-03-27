import { readFileSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");

function readJSON<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    return null;
  }
}

// ── Token Pricing ──
export interface TokenPriceModel {
  model: string;
  modelId: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
  contextWindow: number;
  maxOutput: number | null;
  fetchedAt: string;
}

export interface TokenPricingData {
  fetchedAt: string;
  modelCount: number;
  models: TokenPriceModel[];
}

export function getTokenPricing(): TokenPricingData | null {
  return readJSON<TokenPricingData>(join(DATA_DIR, "token-pricing", "current.json"));
}

export interface TokenPricingHistory {
  lastUpdated: string;
  entries: Record<string, Array<{ modelId: string; inputPerMillion: number; outputPerMillion: number }>>;
}

export function getTokenPricingHistory(): TokenPricingHistory | null {
  return readJSON<TokenPricingHistory>(join(DATA_DIR, "token-pricing", "history.json"));
}

// ── GPU Pricing ──
export interface GPUSummary {
  gpuModel: string;
  onDemand: { min: number | null; median: number | null; max: number | null; count: number };
  spot: { min: number | null; median: number | null; max: number | null; count: number };
  availabilityPct: number;
  offeringCount: number;
  totalGpusAvailable: number;
  totalGpusRented: number;
  avgReliability: number;
  regions: Record<string, number>;
}

export interface GPUPricingData {
  fetchedAt: string;
  source: string;
  offeringCount: number;
  summaries: GPUSummary[];
}

export function getGPUPricing(): GPUPricingData | null {
  return readJSON<GPUPricingData>(join(DATA_DIR, "gpu-pricing", "current.json"));
}

export interface GPUPricingHistory {
  lastUpdated: string;
  entries: Record<string, GPUSummary[]>;
}

export function getGPUPricingHistory(): GPUPricingHistory | null {
  return readJSON<GPUPricingHistory>(join(DATA_DIR, "gpu-pricing", "history.json"));
}

// ── Indices ──
export interface LLMflationData {
  computedAt: string;
  date: string;
  basePricePerMillion: number;
  baseDate: string;
  currentIndex: number;
  components: Record<string, number | null>;
  weights: Record<string, number>;
}

export function getLLMflation(): LLMflationData | null {
  return readJSON<LLMflationData>(join(DATA_DIR, "indices", "llmflation.json"));
}

export interface InferenceMarginEntry {
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

export interface InferenceMarginData {
  computedAt: string;
  date: string;
  margins: InferenceMarginEntry[];
}

export function getInferenceMargins(): InferenceMarginData | null {
  return readJSON<InferenceMarginData>(join(DATA_DIR, "indices", "inference-margin.json"));
}

// ── Static Data ──
export interface NVIDIATier {
  tier: string;
  pricePerMillionOutput: number;
  workload: string;
  hardware: string;
  examples: string[];
  lpxRequired: boolean;
}

export function getNVIDIATiers(): { tiers: NVIDIATier[] } | null {
  return readJSON<{ tiers: NVIDIATier[] }>(join(DATA_DIR, "static", "nvidia-tiers.json"));
}

export interface RevenuePerWattPlatform {
  platform: string;
  year: string;
  revPerSecPerMW: number;
  tokPerSecPerUser: number;
  costPerMTok: number;
  tdpWatts: number;
  notes: string;
}

export function getRevenuePerWatt(): { platforms: RevenuePerWattPlatform[]; derivation: { title: string; steps: string[] } } | null {
  return readJSON(join(DATA_DIR, "static", "revenue-per-watt.json"));
}

export interface CostStackComponent {
  component: string;
  pctBlackwell: number;
  pctRubin: number;
  pctRubinLPX: number;
  color: string;
}

export function getCostStack(): { components: CostStackComponent[]; insight: string } | null {
  return readJSON(join(DATA_DIR, "static", "cost-stack.json"));
}

export interface ThroughputProfile {
  gpuOnly: number | null;
  withLPX: number | null;
  quantization: string;
  note?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  params: string;
  class: string;
}

export interface TierHardware {
  mode: "gpuOnly" | "withLPX";
  label: string;
}

export interface GPUThroughput {
  vramGb: number;
  profiles: Record<string, ThroughputProfile>;
}

export interface GPUThroughputData {
  models: ModelInfo[];
  tierHardware: Record<string, TierHardware>;
  lpxCostPerHourAdder: number;
  lpxNote: string;
  gpus: Record<string, GPUThroughput>;
}

export function getGPUThroughput(): GPUThroughputData | null {
  return readJSON(join(DATA_DIR, "static", "gpu-throughput.json"));
}

export interface Constraint {
  name: string;
  supply: string;
  demand: string;
  gap: string;
  trend: string;
  beneficiaries: string[];
  note: string;
}

export function getConstraints(): { constraints: Constraint[] } | null {
  return readJSON(join(DATA_DIR, "static", "constraints.json"));
}

// ── Cloud Accelerators (TPU, Trainium) ──
export function getCloudAccelerators(): { accelerators: GPUSummary[] } | null {
  return readJSON(join(DATA_DIR, "static", "cloud-accelerators.json"));
}

// ── TCO Providers ──
export function getTCOProviders(): { providers: unknown[] } | null {
  return readJSON(join(DATA_DIR, "static", "tco-providers.json"));
}

// ── Inference Provider Margins ──
export function getInferenceProviderMargins(): unknown {
  return readJSON(join(DATA_DIR, "static", "inference-provider-margins.json"));
}
