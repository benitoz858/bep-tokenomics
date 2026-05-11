import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import HardwareSpecs from "@/components/HardwareSpecs";
import { getGPUHardwareSpecs } from "@/lib/data";

export const metadata: Metadata = {
  title: "GPU Hardware Specs — H100, H200, B200 & Beyond",
  description:
    "Reference specs for the leading AI accelerators — NVIDIA H100, H200, B200, GB200, and competing accelerators. FLOPS, HBM capacity, memory bandwidth, NVLink, and TDP, side by side.",
  alternates: { canonical: "/tokenomics/hardware" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/hardware",
    title: "GPU Hardware Specs — H100, H200, B200 & Beyond | BEP Research",
    description:
      "Side-by-side AI accelerator specs: FLOPS, HBM, bandwidth, NVLink, and TDP for the H100/H200/B200 and competing chips.",
  },
};

export default function HardwarePage() {
  const specs = getGPUHardwareSpecs();
  if (!specs) return <SubPageShell title="Hardware Specs"><div className="text-bep-muted">No data</div></SubPageShell>;

  return (
    <SubPageShell title="Hardware Specs">
      <HardwareSpecs data={specs} />
    </SubPageShell>
  );
}
