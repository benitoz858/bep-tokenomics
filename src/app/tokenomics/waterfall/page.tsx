import SubPageShell from "@/components/SubPageShell";
import TokenWaterfall from "@/components/TokenWaterfall";
import { readFileSync } from "fs";
import { join } from "path";

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
