import type { Metadata } from "next";
import { readFileSync } from "fs";
import { join } from "path";
import DashboardV2 from "@/components/DashboardV2";
import {
  getTokenPricing,
  getLLMflation,
  getGPUPricing,
  getGPUPricingHistory,
  getGPUThroughput,
  getCloudAccelerators,
  getCommentary,
  getOrnnUtilization,
  getOrnnOCPI,
} from "@/lib/data";
import { blendedTokenCostFromMix, platformTokenMargin, type ModelMixEntry } from "@/lib/calculations";

export const metadata: Metadata = {
  title: "The Stack — AI Infrastructure Dashboard",
  description:
    "Ben Pouladian's live AI infrastructure dashboard. Daily GPU pricing, token economics, inference margins, LLMflation, and cluster TCO across H100, H200, B200, and beyond.",
  alternates: { canonical: "/tokenomics/v2" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/v2",
    title: "The Stack — AI Infrastructure Dashboard by Ben Pouladian",
    description:
      "Live GPU pricing, token economics, inference margins, and cluster TCO. Updated daily by BEP Research.",
    siteName: "BEP Research",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Stack — AI Infrastructure Dashboard by Ben Pouladian",
    description:
      "Live GPU pricing, token economics, and inference margins. Updated daily by BEP Research.",
    creator: "@benitoz",
    site: "@benitoz",
  },
};

const FALLBACK_TOKEN_MODELS = [
  { model: "GPT-5.4 Pro", modelId: "openai/gpt-5.4", provider: "OpenAI", inputPerMillion: 21, outputPerMillion: 168, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
  { model: "Claude Opus 4.6", modelId: "anthropic/claude-opus-4.6", provider: "Anthropic", inputPerMillion: 5, outputPerMillion: 25, contextWindow: 200000, maxOutput: null, fetchedAt: "" },
  { model: "DeepSeek V3.2", modelId: "deepseek/deepseek-v3.2", provider: "DeepSeek", inputPerMillion: 0.14, outputPerMillion: 0.28, contextWindow: 128000, maxOutput: null, fetchedAt: "" },
];

interface PlatformSummaryRow {
  id: string;
  vendor: string;
  name: string;
  category: string;
  marginPct: number;
  confidence: string;
  verified: boolean;
}

function computePlatformSummary(tokenModels: ReturnType<typeof getTokenPricing>): {
  total: number;
  computable: number;
  profitable: number;
  top3: PlatformSummaryRow[];
  bottom: PlatformSummaryRow | null;
} {
  try {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), "data/static/token-waterfall.json"), "utf-8"),
    );
    const models = tokenModels?.models || [];
    const rows: PlatformSummaryRow[] = [];

    for (const p of raw.platforms || []) {
      const mix: ModelMixEntry[] = (p.modelMix as ModelMixEntry[]) || [];
      if (!mix.length) continue;
      const blended = blendedTokenCostFromMix(mix, models);
      const margin = platformTokenMargin({
        pricingModel: p.customerPricing.model,
        customerPrice: p.customerPricing.price,
        blendedCostPerM: blended.costPerM,
        tokensPerInteraction: p.estimatedModelCost?.tokensPerInteraction ?? null,
        interactionsPerUserPerDay: p.estimatedModelCost?.interactionsPerUserPerDay ?? null,
      });
      if (margin.marginPct === null) continue;
      const verified =
        p.customerPricing?.confidence === "high" &&
        (p.estimatedModelCost?.confidence === "high" || p.estimatedModelCost?.confidence === "medium");
      rows.push({
        id: p.id,
        vendor: p.vendor,
        name: p.name,
        category: p.category,
        marginPct: margin.marginPct,
        confidence: p.estimatedModelCost?.confidence ?? "low",
        verified,
      });
    }

    rows.sort((a, b) => b.marginPct - a.marginPct);
    return {
      total: (raw.platforms || []).length,
      computable: rows.length,
      profitable: rows.filter((r) => r.marginPct > 0).length,
      top3: rows.slice(0, 3),
      bottom: rows[rows.length - 1] || null,
    };
  } catch {
    return { total: 0, computable: 0, profitable: 0, top3: [], bottom: null };
  }
}

export default function V2Page() {
  const tokenData = getTokenPricing();
  const llmflation = getLLMflation();
  const gpuData = getGPUPricing();
  const gpuHistory = getGPUPricingHistory();
  const throughputData = getGPUThroughput();
  const cloudAccel = getCloudAccelerators();
  const commentary = getCommentary();
  const ornnUtilization = getOrnnUtilization();
  const ornnOCPI = getOrnnOCPI();

  const tokenModels = tokenData?.models || FALLBACK_TOKEN_MODELS;
  const baseSummaries = gpuData?.summaries || [];
  const allSummaries = [...baseSummaries, ...(cloudAccel?.accelerators || [])];
  const platformSummary = computePlatformSummary(tokenData);

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
      ornnUtilization={ornnUtilization}
      ornnOCPI={ornnOCPI}
      platformSummary={platformSummary}
    />
  );
}
