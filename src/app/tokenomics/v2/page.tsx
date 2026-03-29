import DashboardV2 from "@/components/DashboardV2";
import {
  getTokenPricing,
  getLLMflation,
  getGPUPricing,
  getGPUPricingHistory,
  getGPUThroughput,
  getCloudAccelerators,
  getCommentary,
} from "@/lib/data";

const FALLBACK_TOKEN_MODELS = [
  { model: "GPT-5.4 Pro", modelId: "openai/gpt-5.4", provider: "OpenAI", inputPerMillion: 21, outputPerMillion: 168, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "Claude Opus 4.6", modelId: "anthropic/claude-opus-4.6", provider: "Anthropic", inputPerMillion: 5, outputPerMillion: 25, contextWindow: 200000, maxOutput: null, fetchedAt: "" },
  { model: "DeepSeek V3.2", modelId: "deepseek/deepseek-v3.2", provider: "DeepSeek", inputPerMillion: 0.14, outputPerMillion: 0.28, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
];

export default function V2Page() {
  const tokenData = getTokenPricing();
  const llmflation = getLLMflation();
  const gpuData = getGPUPricing();
  const gpuHistory = getGPUPricingHistory();
  const throughputData = getGPUThroughput();
  const cloudAccel = getCloudAccelerators();
  const commentary = getCommentary();

  const tokenModels = tokenData?.models || FALLBACK_TOKEN_MODELS;
  const baseSummaries = gpuData?.summaries || [];
  const allSummaries = [...baseSummaries, ...(cloudAccel?.accelerators || [])];

  return (
    <DashboardV2
      tokenModels={tokenModels}
      llmflationIndex={llmflation?.currentIndex}
      gpuPricing={{
        summaries: allSummaries,
        source: gpuData?.source || "",
        fetchedAt: gpuData?.fetchedAt || new Date().toISOString(),
        history: gpuHistory?.entries || {},
      }}
      gpuThroughput={throughputData?.gpus || {}}
      lpxCostAdder={throughputData?.lpxCostPerHourAdder || 2.50}
      commentary={commentary}
    />
  );
}
