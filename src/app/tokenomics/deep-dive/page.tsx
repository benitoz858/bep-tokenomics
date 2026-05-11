import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import LLMflationCurve from "@/components/LLMflationCurve";
import TokenTiers from "@/components/TokenTiers";
import RevenuePerWatt from "@/components/RevenuePerWatt";
import JevonsParadox from "@/components/JevonsParadox";
import TokenCostStack from "@/components/TokenCostStack";
import GPUPriceTracker from "@/components/GPUPriceTracker";
import MemoryMarkets from "@/components/MemoryMarkets";
import {
  getTokenPricing, getTokenPricingHistory, getLLMflation, getNVIDIATiers,
  getRevenuePerWatt, getCostStack, getGPUPricing, getGPUPricingHistory, getCloudAccelerators,
  getOrnnMemory,
} from "@/lib/data";

export const metadata: Metadata = {
  title: "Deep Dive — LLMflation, Token Tiers & Revenue Per Watt",
  description:
    "Deep analysis of AI inference economics: LLMflation curves, NVIDIA token tier shifts, revenue-per-watt by GPU class, Jevons paradox dynamics, GPU price tracking, and HBM memory market structure.",
  alternates: { canonical: "/tokenomics/deep-dive" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/deep-dive",
    title: "Deep Dive — LLMflation, Token Tiers & Revenue Per Watt | BEP Research",
    description:
      "Inference economics deep dive — LLMflation, token tiers, revenue per watt, GPU pricing, and HBM markets.",
  },
};

export default function DeepDivePage() {
  const tokenData = getTokenPricing();
  const tokenHistory = getTokenPricingHistory();
  const llmflation = getLLMflation();
  const tiersData = getNVIDIATiers();
  const rpwData = getRevenuePerWatt();
  const costStackData = getCostStack();
  const gpuData = getGPUPricing();
  const gpuHistory = getGPUPricingHistory();
  const cloudAccel = getCloudAccelerators();
  const memoryData = getOrnnMemory();

  const baseSummaries = gpuData?.summaries || [];
  const allSummaries = [...baseSummaries, ...(cloudAccel?.accelerators || [])];

  return (
    <SubPageShell title="Deep Dive">
      <LLMflationCurve
        models={tokenData?.models || []}
        llmflationIndex={llmflation?.currentIndex}
        history={tokenHistory?.entries || {}}
      />

      <div className="mt-8">
        <TokenTiers tiers={tiersData?.tiers || []} />
      </div>

      <div className="mt-8">
        <GPUPriceTracker
          summaries={allSummaries}
          source={gpuData?.source || ""}
          fetchedAt={gpuData?.fetchedAt || new Date().toISOString()}
          history={gpuHistory?.entries || {}}
        />
      </div>

      {rpwData && (
        <div className="mt-8">
          <RevenuePerWatt platforms={rpwData.platforms} derivation={rpwData.derivation} />
        </div>
      )}

      <div className="mt-8">
        <JevonsParadox />
      </div>

      {costStackData && (
        <div className="mt-8">
          <TokenCostStack components={costStackData.components} insight={costStackData.insight} />
        </div>
      )}

      {memoryData && memoryData.current.length > 0 && (
        <div className="mt-8">
          <MemoryMarkets data={memoryData} />
        </div>
      )}
    </SubPageShell>
  );
}
