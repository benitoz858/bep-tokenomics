import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Sources & Methodology",
  description:
    "Where BEP Research data comes from — live feeds (OpenRouter, Vast.ai, Ornn AI OCPI), reference benchmarks, and the methodology behind every published number.",
  alternates: { canonical: "/tokenomics/sources" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/sources",
    title: "Data Sources & Methodology | BEP Research",
    description:
      "Live feeds, reference benchmarks, and the methodology behind BEP Research's published AI infrastructure numbers.",
  },
};

export default function SourcesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
