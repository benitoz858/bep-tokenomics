import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import TokenWaterfall from "@/components/TokenWaterfall";
import { readFileSync } from "fs";
import { join } from "path";
import { getGPUPricing, getGPUThroughput, getTokenPricing } from "@/lib/data";
import { costPerMillionFromGPU } from "@/lib/calculations";

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

const TCO_MULTIPLIER = 1.25;

export default function WaterfallPage() {
  const data = getWaterfallData();
  const gpu = getGPUPricing();
  const throughput = getGPUThroughput();
  const tokens = getTokenPricing();

  const h100 = gpu?.summaries.find((s) => s.gpuModel === "nvidia-h100");
  const h100Spot = h100?.spot.median || h100?.onDemand.median || 0;
  const h100Tco = h100Spot * TCO_MULTIPLIER;
  const h100TokPerSec = throughput?.gpus["nvidia-h100"]?.profiles["llama-70b"]?.gpuOnly || 0;
  const h100CostPerM = h100TokPerSec && h100Tco
    ? costPerMillionFromGPU(h100Tco, h100TokPerSec)
    : 0;

  return (
    <SubPageShell title="Token Cost Waterfall">
      <TokenWaterfall
        data={data}
        liveStages={{
          h100SpotPerHr: h100Spot,
          h100TcoPerHr: h100Tco,
          h100CostPerM,
          h100TokPerSec,
        }}
        liveTokenModels={tokens?.models || []}
      />
    </SubPageShell>
  );
}
