import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import ProviderMap from "@/components/ProviderMap";
import { getProviderEndpoints, getTokenPricing } from "@/lib/data";

export const metadata: Metadata = {
  title: "Inference Provider Competitive Map — Where Open Models Live",
  description:
    "Live head-to-head pricing across the major inference providers — Nebius, Together, Fireworks, DeepInfra, Groq, Cerebras, Lambda — for the open-weights models the industry actually routes. Refreshed daily.",
  alternates: { canonical: "/tokenomics/providers" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/providers",
    title: "Inference Provider Competitive Map | BEP Research",
    description:
      "Live head-to-head pricing across the major open-weights inference providers, refreshed daily.",
  },
};

export default function ProvidersPage() {
  const endpoints = getProviderEndpoints();
  const tokens = getTokenPricing();
  return (
    <SubPageShell title="Inference Provider Competitive Map">
      <ProviderMap
        endpoints={endpoints}
        nebiusModels={(tokens?.models || []).filter((m) => m.source === "Nebius")}
      />
    </SubPageShell>
  );
}
