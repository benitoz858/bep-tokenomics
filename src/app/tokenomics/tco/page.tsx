import SubPageShell from "@/components/SubPageShell";
import TCOCalculator from "@/components/TCOCalculator";
import { getTCOProviders } from "@/lib/data";

export default function TCOPage() {
  const tcoData = getTCOProviders();

  return (
    <SubPageShell title="Cluster TCO">
      <TCOCalculator providers={(tcoData?.providers || []) as never[]} />
    </SubPageShell>
  );
}
