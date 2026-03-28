import SubPageShell from "@/components/SubPageShell";
import InferenceMargin from "@/components/InferenceMargin";
import InferenceProviderMargins from "@/components/InferenceProviderMargins";
import { getGPUPricing, getGPUThroughput, getCloudAccelerators, getInferenceProviderMargins } from "@/lib/data";

export default function MarginsPage() {
  const gpuData = getGPUPricing();
  const throughputData = getGPUThroughput();
  const cloudAccel = getCloudAccelerators();
  const marginData = getInferenceProviderMargins();

  const baseSummaries = gpuData?.summaries || [];
  const allSummaries = [...baseSummaries, ...(cloudAccel?.accelerators || [])];

  return (
    <SubPageShell title="Inference Margins">
      <InferenceMargin
        gpuPricing={allSummaries}
        throughput={throughputData?.gpus || {}}
        models={throughputData?.models || []}
        tierHardware={throughputData?.tierHardware || {}}
        lpxCostAdder={throughputData?.lpxCostPerHourAdder || 2.50}
      />
      <div className="mt-8">
        <InferenceProviderMargins data={marginData} />
      </div>
    </SubPageShell>
  );
}
