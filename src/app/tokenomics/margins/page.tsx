import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import InferenceMargin from "@/components/InferenceMargin";
import InferenceProviderMargins from "@/components/InferenceProviderMargins";
import { getGPUPricing, getGPUThroughput, getCloudAccelerators, getInferenceProviderMargins } from "@/lib/data";

export const metadata: Metadata = {
  title: "Inference Margins — Token Pricing vs GPU Cost",
  description:
    "Live inference margin analysis. Per-model token pricing vs underlying GPU compute cost across H100, H200, and B200 — with provider-by-provider margin breakdowns updated daily.",
  alternates: { canonical: "/tokenomics/margins" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/margins",
    title: "Inference Margins — Token Pricing vs GPU Cost | BEP Research",
    description:
      "Live margin analysis: per-model token pricing vs underlying GPU compute cost, with provider-level breakdowns.",
  },
};

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
