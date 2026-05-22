import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import Frontier from "@/components/Frontier";
import { getTokenPricing } from "@/lib/data";

export const metadata: Metadata = {
  title: "The Open-Model Frontier — Cost × Context Window",
  description:
    "Where every tracked open-weights model sits on the cost vs. context-window frontier. The points on the Pareto edge are the ones worth routing through.",
  alternates: { canonical: "/tokenomics/frontier" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/frontier",
    title: "The Open-Model Frontier — Cost × Context | BEP Research",
    description: "Pareto frontier across cost and context window for tracked open-weights models, refreshed daily.",
  },
};

export default function FrontierPage() {
  const tokens = getTokenPricing();
  return (
    <SubPageShell title="The Open-Model Frontier">
      <Frontier models={tokens?.models || []} />
    </SubPageShell>
  );
}
