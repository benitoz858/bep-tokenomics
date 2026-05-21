import { readFileSync } from "fs";
import { join } from "path";
import { getTokenPricing, getTokenPricingHistory, type TokenPriceModel } from "@/lib/data";
import NebiusPreview, { type NebiusPreviewProps } from "@/components/NebiusPreview";

interface WaterfallPlatform {
  id: string;
  name: string;
  vendor: string;
  category: string;
  tier: string;
  modelMix?: Array<{ modelId?: string; proprietary?: string; weight: number; role?: string }>;
}

function getWaterfall(): { platforms: WaterfallPlatform[] } | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data/static/token-waterfall.json"), "utf-8"));
  } catch {
    return null;
  }
}

// Normalize model identifiers so platform-mix entries match Nebius catalog entries
// regardless of casing, hyphen/underscore drift, or org prefix.
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[-_]/g, "").split("/").pop() || id.toLowerCase();
}

const CLOSED_PREFIXES = ["openai/", "anthropic/", "google/", "x-ai/"];

export default function NebiusPreviewPage() {
  const tokens = getTokenPricing();
  const history = getTokenPricingHistory();
  const waterfall = getWaterfall();

  const all = tokens?.models || [];
  const nebius: TokenPriceModel[] = all.filter((m) => m.source === "Nebius");

  const catalog = [...nebius].sort((a, b) => a.outputPerMillion - b.outputPerMillion);
  const floor = catalog.length > 0 ? catalog[0] : null;

  const distinctCreators = new Set(nebius.map((m) => m.provider)).size;
  const maxContext = nebius.reduce((mx, m) => Math.max(mx, m.contextWindow || 0), 0);
  const maxContextModel = nebius.reduce<TokenPriceModel | null>(
    (best, m) => ((m.contextWindow || 0) > (best?.contextWindow || 0) ? m : best),
    null,
  );

  // Platform open-model exposure across the full BEP enterprise panel. We keep
  // every tracked platform (not just those Nebius already serves) so the chart
  // shows the actual shape of enterprise model usage — closed-frontier-heavy
  // today, with the data-cloud platforms (Snowflake, Databricks) currently the
  // only ones routing Nebius-hosted open weights.
  const nebiusNormSet = new Set(nebius.map((n) => normalizeId(n.modelId)));
  const platforms = (waterfall?.platforms || [])
    .map((p) => {
      const mix = p.modelMix || [];
      let openShare = 0;
      let closedShare = 0;
      let proprietaryShare = 0;
      const matchedModels: string[] = [];
      for (const e of mix) {
        if (e.proprietary) {
          proprietaryShare += e.weight;
          continue;
        }
        if (!e.modelId) continue;
        if (CLOSED_PREFIXES.some((prefix) => e.modelId!.startsWith(prefix))) {
          closedShare += e.weight;
        } else {
          openShare += e.weight;
          if (nebiusNormSet.has(normalizeId(e.modelId))) {
            matchedModels.push(e.modelId);
          }
        }
      }
      return {
        id: p.id,
        name: p.name,
        vendor: p.vendor,
        category: p.category,
        tier: p.tier,
        openShare,
        closedShare,
        proprietaryShare,
        matchedModels,
      };
    })
    .sort((a, b) => b.openShare - a.openShare);

  const platformsAddressableNow = platforms.filter((p) => p.matchedModels.length > 0).length;

  // Per-day trajectory of Nebius's lowest output rate. Only emits points for
  // days where history.json actually contains Nebius entries — never a
  // synthesized line.
  const trajectory: Array<{ date: string; floor: number }> = [];
  const entries = history?.entries || {};
  for (const d of Object.keys(entries).sort()) {
    const nebDay = (entries[d] || []).filter((e) => (e as { source?: string }).source === "Nebius");
    if (nebDay.length === 0) continue;
    const minOut = Math.min(...nebDay.map((e) => e.outputPerMillion).filter((v) => v > 0));
    if (isFinite(minOut)) trajectory.push({ date: d, floor: minOut });
  }

  const props: NebiusPreviewProps = {
    generatedAt: tokens?.fetchedAt || new Date().toISOString(),
    catalog: catalog.map((m) => ({
      model: m.model,
      modelId: m.modelId,
      provider: m.provider,
      inputPerMillion: m.inputPerMillion,
      outputPerMillion: m.outputPerMillion,
      contextWindow: m.contextWindow || 0,
    })),
    catalogSize: nebius.length,
    floor: floor
      ? { display: floor.model, modelId: floor.modelId, outputPerMillion: floor.outputPerMillion }
      : null,
    distinctCreators,
    maxContext,
    maxContextModel: maxContextModel ? { display: maxContextModel.model, modelId: maxContextModel.modelId } : null,
    platforms,
    platformsAddressableNow,
    trajectory,
  };

  return <NebiusPreview {...props} />;
}
