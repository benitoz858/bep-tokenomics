import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import CostPerTaskCalculator from "@/components/CostPerTaskCalculator";
import { getTokenPricing, getCostPerTaskWorkloads } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cost-per-task Calculator — What Each AI Workload Actually Costs",
  description:
    "Interactive calculator for the end-to-end cost of typical AI workloads across providers and models. Pick a workload (code completion, RAG, coding agent, support agent, voice) and see live cost-per-task numbers, not just $/M tokens.",
  alternates: { canonical: "/tokenomics/cost-per-task" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/cost-per-task",
    title: "Cost-per-task Calculator | BEP Research",
    description: "What each AI workload actually costs across providers and models — live, interactive.",
  },
};

export default function CostPerTaskPage() {
  const tokens = getTokenPricing();
  const workloads = getCostPerTaskWorkloads();
  return (
    <SubPageShell title="Cost-per-task Calculator">
      <CostPerTaskCalculator models={tokens?.models || []} workloads={workloads} />
    </SubPageShell>
  );
}
