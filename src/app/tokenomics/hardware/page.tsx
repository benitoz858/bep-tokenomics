import SubPageShell from "@/components/SubPageShell";
import HardwareSpecs from "@/components/HardwareSpecs";
import { getGPUHardwareSpecs } from "@/lib/data";

export default function HardwarePage() {
  const specs = getGPUHardwareSpecs();
  if (!specs) return <SubPageShell title="Hardware Specs"><div className="text-bep-muted">No data</div></SubPageShell>;

  return (
    <SubPageShell title="Hardware Specs">
      <HardwareSpecs data={specs} />
    </SubPageShell>
  );
}
