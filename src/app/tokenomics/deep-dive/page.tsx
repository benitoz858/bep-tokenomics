import SubPageShell from "@/components/SubPageShell";
import LLMflationCurve from "@/components/LLMflationCurve";
import TokenTiers from "@/components/TokenTiers";
import RevenuePerWatt from "@/components/RevenuePerWatt";
import JevonsParadox from "@/components/JevonsParadox";
import TokenCostStack from "@/components/TokenCostStack";
import GPUPriceTracker from "@/components/GPUPriceTracker";
import {
  getTokenPricing, getTokenPricingHistory, getLLMflation, getNVIDIATiers,
  getRevenuePerWatt, getCostStack, getGPUPricing, getGPUPricingHistory, getCloudAccelerators,
} from "@/lib/data";

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
    </SubPageShell>
  );
}
