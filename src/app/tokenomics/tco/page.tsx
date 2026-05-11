import type { Metadata } from "next";
import SubPageShell from "@/components/SubPageShell";
import TCOCalculator from "@/components/TCOCalculator";
import { getTCOProviders } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cluster TCO — GPU Cloud Total Cost of Ownership",
  description:
    "Interactive total cost of ownership calculator for GPU clusters. Compare hyperscaler and NeoCloud providers across hourly rates, utilization, power costs, and amortized capex.",
  alternates: { canonical: "/tokenomics/tco" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/tokenomics/tco",
    title: "Cluster TCO — GPU Cloud Total Cost of Ownership | BEP Research",
    description:
      "Compare hyperscaler vs NeoCloud GPU cluster TCO across hourly rates, utilization, power, and capex.",
  },
};

export default function TCOPage() {
  const tcoData = getTCOProviders();

  return (
    <SubPageShell title="Cluster TCO">
      <TCOCalculator providers={(tcoData?.providers || []) as never[]} />
    </SubPageShell>
  );
}
