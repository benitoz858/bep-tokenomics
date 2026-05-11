import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import TokenWaterfall from "@/components/TokenWaterfall";
import { readFileSync } from "fs";
import { join } from "path";

export const metadata: Metadata = {
  title: "Token Cost Waterfall — Where the Money Goes",
  description:
    "A waterfall breakdown of where every dollar of token revenue lands — GPU compute, memory, networking, power, datacenter overhead, software margin, and provider take rate.",
  alternates: { canonical: "/tokenomics/waterfall" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/waterfall",
    title: "Token Cost Waterfall — Where the Money Goes | BEP Research",
    description:
      "Where every dollar of inference token revenue actually lands: compute, memory, power, networking, software margin, take rate.",
  },
};

function getWaterfallData() {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data/static/token-waterfall.json"), "utf-8"));
  } catch {
    return null;
  }
}

export default function WaterfallPage() {
  const data = getWaterfallData();

  return (
    <SubPageShell title="Token Cost Waterfall">
      <TokenWaterfall data={data} />
    </SubPageShell>
  );
}
