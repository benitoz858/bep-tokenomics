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

// Normalize model identifiers so a Nebius slug ("Qwen/Qwen3.5-397B-A17B")
// matches an OpenRouter slug ("qwen/qwen3.5-397b-a17b") and platform mix entries
// referencing the same underlying open weights regardless of casing or org prefix.
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[-_]/g, "").split("/").pop() || id.toLowerCase();
}

export default function NebiusPreviewPage() {
  const tokens = getTokenPricing();
  const history = getTokenPricingHistory();
  const waterfall = getWaterfall();

  const all = tokens?.models || [];
  const nebius: TokenPriceModel[] = all.filter((m) => m.source === "Nebius");
  const market: TokenPriceModel[] = all.filter((m) => m.source !== "Nebius");

  // Build normalized lookup from the broader (OpenRouter-aggregate) market so we
  // can do head-to-head comparisons on the open models Nebius hosts.
  const marketByNorm = new Map<string, TokenPriceModel>();
  for (const m of market) marketByNorm.set(normalizeId(m.modelId), m);

  const catalog = [...nebius].sort((a, b) => a.outputPerMillion - b.outputPerMillion);

  const headToHead = catalog
    .map((n) => {
      const peer = marketByNorm.get(normalizeId(n.modelId));
      if (!peer) return null;
      const nebOut = n.outputPerMillion;
      const peerOut = peer.outputPerMillion;
      const deltaPct = peerOut > 0 ? ((peerOut - nebOut) / peerOut) * 100 : 0;
      return {
        modelId: n.modelId,
        display: n.model,
        nebiusIn: n.inputPerMillion,
        nebiusOut: nebOut,
        marketIn: peer.inputPerMillion,
        marketOut: peerOut,
        deltaPct,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.deltaPct - a.deltaPct);

  // Floor: cheapest Nebius output rate across the catalog.
  const floor = catalog.length > 0 ? catalog[0] : null;

  // Average head-to-head Nebius discount vs. the OpenRouter market median, for
  // the keynote line. Skip entries where the peer rate is non-positive.
  const validDeltas = headToHead.filter((h) => h.marketOut > 0);
  const avgDiscountPct =
    validDeltas.length > 0
      ? validDeltas.reduce((s, h) => s + h.deltaPct, 0) / validDeltas.length
      : 0;

  // Platform Nebius-addressability: for each tracked platform, how much of the
  // model mix (by weight) is open-weights served by Nebius today? This is the
  // GTM lever — platforms with high open-share are the easiest "move to Nebius"
  // conversations.
  const nebiusNormSet = new Set(nebius.map((n) => normalizeId(n.modelId)));
  const platformAddressability = (waterfall?.platforms || [])
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
        if (nebiusNormSet.has(normalizeId(e.modelId))) {
          openShare += e.weight;
          matchedModels.push(e.modelId);
        } else {
          closedShare += e.weight;
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
    .filter((p) => p.openShare > 0)
    .sort((a, b) => b.openShare - a.openShare);

  // Quarter-end trajectory of Nebius's lowest output price, for the LLMflation
  // overlay. We can only reconstruct this for dates where the history file
  // actually contains Nebius-sourced entries.
  const trajectory: Array<{ date: string; floor: number }> = [];
  const entries = history?.entries || {};
  const dates = Object.keys(entries).sort();
  for (const d of dates) {
    const day = entries[d] || [];
    const nebDay = day.filter((e) => (e as { source?: string }).source === "Nebius");
    if (nebDay.length === 0) continue;
    const minOut = Math.min(...nebDay.map((e) => e.outputPerMillion).filter((v) => v > 0));
    if (isFinite(minOut)) trajectory.push({ date: d, floor: minOut });
  }

  const props: NebiusPreviewProps = {
    generatedAt: tokens?.fetchedAt || new Date().toISOString(),
    catalog,
    headToHead,
    floor: floor ? { display: floor.model, modelId: floor.modelId, outputPerMillion: floor.outputPerMillion } : null,
    avgDiscountPct,
    catalogSize: nebius.length,
    marketComparableCount: validDeltas.length,
    platforms: platformAddressability,
    trajectory,
  };

  return <NebiusPreview {...props} />;
}
