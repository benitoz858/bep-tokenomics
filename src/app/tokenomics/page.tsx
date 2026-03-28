import Dashboard from "@/components/Dashboard";
import {
  getTokenPricing,
  getTokenPricingHistory,
  getLLMflation,
  getNVIDIATiers,
  getRevenuePerWatt,
  getCostStack,
  getGPUPricing,
  getGPUPricingHistory,
  getGPUThroughput,
  getCloudAccelerators,
  getTCOProviders,
  getInferenceProviderMargins,
} from "@/lib/data";

// Fallback data when live data hasn't been fetched yet
const FALLBACK_TOKEN_MODELS = [
  { model: "GPT-5.4 Pro", modelId: "openai/gpt-5.4", provider: "OpenAI", inputPerMillion: 21, outputPerMillion: 168, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "GPT-5.2", modelId: "openai/gpt-5.2", provider: "OpenAI", inputPerMillion: 1.75, outputPerMillion: 14, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "GPT-5", modelId: "openai/gpt-5", provider: "OpenAI", inputPerMillion: 1.25, outputPerMillion: 10, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "Claude Opus 4.6", modelId: "anthropic/claude-opus-4.6", provider: "Anthropic", inputPerMillion: 5, outputPerMillion: 25, contextWindow: 200000, maxOutput: null, fetchedAt: "" },
  { model: "Claude Sonnet 4.6", modelId: "anthropic/claude-sonnet-4.6", provider: "Anthropic", inputPerMillion: 3, outputPerMillion: 15, contextWindow: 200000, maxOutput: null, fetchedAt: "" },
  { model: "Claude Haiku 4.5", modelId: "anthropic/claude-haiku-4.5", provider: "Anthropic", inputPerMillion: 1, outputPerMillion: 5, contextWindow: 200000, maxOutput: null, fetchedAt: "" },
  { model: "Gemini 2.5 Pro", modelId: "google/gemini-2.5-pro", provider: "Google", inputPerMillion: 1.25, outputPerMillion: 10, contextWindow: 1000000, maxOutput: null, fetchedAt: "" },
  { model: "Gemini 2.5 Flash", modelId: "google/gemini-2.5-flash", provider: "Google", inputPerMillion: 0.30, outputPerMillion: 2.50, contextWindow: 1000000, maxOutput: null, fetchedAt: "" },
  { model: "Gemini Flash-Lite", modelId: "google/gemini-2.0-flash-lite", provider: "Google", inputPerMillion: 0.075, outputPerMillion: 0.30, contextWindow: 1000000, maxOutput: null, fetchedAt: "" },
  { model: "DeepSeek V3.2", modelId: "deepseek/deepseek-v3.2", provider: "DeepSeek", inputPerMillion: 0.14, outputPerMillion: 0.28, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "Grok 4.1 Fast", modelId: "x-ai/grok-4.1-fast", provider: "xAI", inputPerMillion: 0.20, outputPerMillion: 0.50, contextWindow: 131072, maxOutput: null, fetchedAt: "" },
  { model: "Llama 4 Maverick", modelId: "meta-llama/llama-4-maverick", provider: "Meta", inputPerMillion: 0.15, outputPerMillion: 0.60, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
];

const FALLBACK_GPU_PRICING = {
  summaries: [
    { gpuModel: "nvidia-a100", onDemand: { min: 1.10, median: 1.50, max: 2.20, count: 0 }, spot: { min: 0.70, median: 0.90, max: 1.30, count: 0 }, availabilityPct: 85, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
    { gpuModel: "nvidia-h100", onDemand: { min: 2.00, median: 2.69, max: 3.50, count: 0 }, spot: { min: 1.50, median: 2.00, max: 2.80, count: 0 }, availabilityPct: 70, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
    { gpuModel: "nvidia-h200", onDemand: { min: 3.20, median: 3.80, max: 4.50, count: 0 }, spot: { min: 2.40, median: 3.00, max: 3.80, count: 0 }, availabilityPct: 45, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
    { gpuModel: "nvidia-b200", onDemand: { min: 4.50, median: 5.50, max: 7.00, count: 0 }, spot: { min: 3.50, median: 4.20, max: 5.50, count: 0 }, availabilityPct: 25, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
    { gpuModel: "nvidia-gb200", onDemand: { min: 8.00, median: 10.00, max: 14.00, count: 0 }, spot: { min: null, median: null, max: null, count: 0 }, availabilityPct: 10, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
    { gpuModel: "amd-mi300x", onDemand: { min: 1.80, median: 2.40, max: 3.20, count: 0 }, spot: { min: 1.20, median: 1.60, max: 2.20, count: 0 }, availabilityPct: 60, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
  ],
  source: "BEP Research estimates (configure API keys for live data)",
  fetchedAt: new Date().toISOString(),
};

export default function Home() {
  // Load live data, fall back to static
  const tokenData = getTokenPricing();
  const tokenHistory = getTokenPricingHistory();
  const llmflation = getLLMflation();
  const tiersData = getNVIDIATiers();
  const rpwData = getRevenuePerWatt();
  const costStackData = getCostStack();
  const gpuData = getGPUPricing();
  const gpuHistory = getGPUPricingHistory();
  const cloudAccel = getCloudAccelerators();
  const tcoData = getTCOProviders();
  const marginData = getInferenceProviderMargins();
  const throughputData = getGPUThroughput();

  const tokenModels = tokenData?.models || FALLBACK_TOKEN_MODELS;
  const nvidiaTiers = tiersData?.tiers || [];
  const revenuePerWatt = rpwData || { platforms: [], derivation: { title: "", steps: [] } };
  const costStack = costStackData || { components: [], insight: "" };
  // Merge GPU pricing with cloud accelerators (TPU, Trainium)
  const baseSummaries = gpuData?.summaries || FALLBACK_GPU_PRICING.summaries;
  const allSummaries = [...baseSummaries, ...(cloudAccel?.accelerators || [])];
  const gpuPricing = gpuData
    ? { summaries: allSummaries, source: gpuData.source + " + GCP/AWS", fetchedAt: gpuData.fetchedAt, history: gpuHistory?.entries || {} }
    : { ...FALLBACK_GPU_PRICING, summaries: allSummaries, history: {} as Record<string, typeof FALLBACK_GPU_PRICING.summaries> };
  const gpuThroughput = throughputData?.gpus || {};
  const throughputModels = throughputData?.models || [];
  const tierHardware = throughputData?.tierHardware || {};
  const lpxCostAdder = throughputData?.lpxCostPerHourAdder || 2.50;

  return (
    <Dashboard
      tokenModels={tokenModels}
      tokenHistory={tokenHistory?.entries || {}}
      llmflationIndex={llmflation?.currentIndex}
      nvidiaTiers={nvidiaTiers}
      revenuePerWatt={revenuePerWatt}
      costStack={costStack}
      gpuPricing={gpuPricing}
      gpuThroughput={gpuThroughput}
      throughputModels={throughputModels}
      tierHardware={tierHardware}
      lpxCostAdder={lpxCostAdder}
      tcoProviders={(tcoData?.providers || []) as never[]}
      inferenceMarginData={marginData}
    />
  );
}
