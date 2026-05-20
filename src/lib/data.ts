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
  source?: string; // Inference provider: "Nebius" for Nebius Token Factory; OpenRouter aggregate by default
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

// ── Platform registry + auto-refreshed SEC disclosures ──
// The registry is small + hand-maintained (ticker, CIK, lastVerifiedAt).
// The disclosures file is rewritten daily by scripts/fetch-public-disclosures.ts.
export interface PlatformRegistryEntry {
  ticker: string | null;
  secCik: string | null;
  lastVerifiedAt: string; // ISO date
  privateCompany?: boolean;
  foreignPrivateIssuer?: boolean;
}

export interface PlatformRegistry {
  lastUpdated: string;
  platforms: Record<string, PlatformRegistryEntry>;
}

export interface QuarterSnapshot {
  period: string;
  periodEnd: string;
  revenue: number;
  currency: string;
  revenueYoY: number | null;
  filedAt: string;
  form: string;
  concept: string;
  taxonomy: string;
  source: "SEC XBRL";
  sourceUrl: string;
  fetchedAt: string;
}

export interface PlatformDisclosures {
  lastUpdated: string | null;
  snapshots: Record<string, { latestQuarter?: QuarterSnapshot; error?: string; fetchedAt?: string }>;
}

export function getPlatformRegistry(): PlatformRegistry | null {
  return readJSON<PlatformRegistry>(join(DATA_DIR, "static", "platform-registry.json"));
}

export function getPlatformDisclosures(): PlatformDisclosures | null {
  return readJSON<PlatformDisclosures>(join(DATA_DIR, "static", "platform-disclosures.json"));
}

// ── Pricing-page drift checks (auto-fetched by scripts/check-pricing-pages.ts) ──
export interface PricingCheck {
  platformId: string;
  vendor: string;
  productName: string;
  pricingUrl: string;
  currentPrice: number;
  currentUnit: string;
  extractedPrice: number | null;
  extractedUnit: string | null;
  match: "exact" | "close" | "mismatch" | "extraction-failed" | "fetch-failed";
  notes: string;
  fetchedAt: string;
  rawSnippet?: string;
}

export interface PricingChecksFile {
  lastUpdated: string | null;
  checks: PricingCheck[];
}

export function getPricingChecks(): PricingChecksFile | null {
  return readJSON<PricingChecksFile>(join(DATA_DIR, "static", "pricing-checks.json"));
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

// ── Market Commentary ──
export function getCommentary(): unknown {
  return readJSON(join(DATA_DIR, "commentary", "latest.json"));
}

// ── GPU Hardware Specs ──
export interface GPUHardwareSpec {
  id: string;
  name: string;
  vendor: "nvidia" | "amd";
  memoryGB: number;
  memoryType: string;
  memoryBandwidthTBs: number;
  fp4TFLOPS: number | null;
  fp8TFLOPS: number;
  bf16TFLOPS: number;
  scaleUpTech: string;
  scaleUpBandwidthGBs: number;
  scaleUpDomain: number;
  scaleOutBandwidthGBs: number | null;
}

export interface GPUHardwareSpecsData {
  source: string;
  lastUpdated: string;
  gpus: GPUHardwareSpec[];
}

export function getGPUHardwareSpecs(): GPUHardwareSpecsData | null {
  return readJSON<GPUHardwareSpecsData>(join(DATA_DIR, "static", "gpu-hardware-specs.json"));
}

// ── Ornn AI Data ──
export interface OrnnUtilizationHistory {
  fetchedAt: string;
  startDate: string;
  endDate: string;
  gpus: Record<string, Array<{ date: string; utilization: number }>>;
}

export function getOrnnUtilization(): OrnnUtilizationHistory | null {
  return readJSON<OrnnUtilizationHistory>(join(DATA_DIR, "ornn", "gpu-utilization-history.json"));
}

export interface OrnnOCPIPrices {
  fetchedAt: string;
  latest: Record<string, { price: number; volatility: number }>;
  history: Record<string, Array<{ date: string; price: number; volatility: number }>>;
}

export function getOrnnOCPI(): OrnnOCPIPrices | null {
  return readJSON<OrnnOCPIPrices>(join(DATA_DIR, "ornn", "ocpi-prices.json"));
}

export interface OrnnMemoryPricing {
  fetchedAt: string;
  date: string;
  current: Array<{
    key: string; label: string; category: string;
    price: number; changePct: number; weeklyHigh: number; weeklyLow: number;
  }>;
  history: Record<string, Array<{ date: string; price: number }>>;
}

export function getOrnnMemory(): OrnnMemoryPricing | null {
  return readJSON<OrnnMemoryPricing>(join(DATA_DIR, "ornn", "memory-pricing.json"));
}
