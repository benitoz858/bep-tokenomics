import { readFileSync } from "fs";
import { join } from "path";
import { getTokenPricing, type TokenPriceModel } from "@/lib/data";
import NebiusPreview, {
  type FieldComparison,
  type FieldEndpoint,
  type NebiusPreviewProps,
} from "@/components/NebiusPreview";

interface WaterfallPlatform {
  id: string;
  name: string;
  vendor: string;
  category: string;
  tier: string;
  modelMix?: Array<{ modelId?: string; proprietary?: string; weight: number; role?: string }>;
}

interface ProviderEndpointEntry {
  providerName: string;
  contextLength: number;
  maxCompletion?: number;
  inputPerMillion: number;
  outputPerMillion: number;
  quantization?: string;
  uptime30m?: number;
}

interface ProviderEndpointsFile {
  fetchedAt: string;
  modelCount: number;
  models: Record<string, { endpoints: ProviderEndpointEntry[] }>;
}

function getWaterfall(): { platforms: WaterfallPlatform[] } | null {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "data/static/token-waterfall.json"), "utf-8"));
  } catch {
    return null;
  }
}

function getProviderEndpoints(): ProviderEndpointsFile | null {
  try {
    return JSON.parse(
      readFileSync(join(process.cwd(), "data/token-pricing/provider-endpoints.json"), "utf-8"),
    );
  } catch {
    return null;
  }
}

// Catalog-friendly display name from an OpenRouter modelId like
// "meta-llama/llama-3.3-70b-instruct" -> "Llama 3.3 70B Instruct".
function displayShortName(modelId: string): string {
  const slug = modelId.split("/").pop() || modelId;
  return slug
    .split("-")
    .map((part) => {
      if (/^\d/.test(part)) return part.toUpperCase();
      if (part.length <= 3) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function buildFieldComparisons(file: ProviderEndpointsFile | null): FieldComparison[] {
  if (!file) return [];
  const comparisons: FieldComparison[] = [];
  for (const [modelId, entry] of Object.entries(file.models)) {
    // Production-grade filter: drop endpoints with truncated context (≥32K covers
    // most models' native context; the long-context flagships go up to 1M+).
    const productionEndpoints = entry.endpoints
      .filter((e) => e.contextLength >= 32_000)
      .filter((e) => e.outputPerMillion > 0);

    // Dedupe per provider — keep the cheapest output endpoint.
    const byProvider = new Map<string, ProviderEndpointEntry>();
    for (const e of productionEndpoints) {
      const existing = byProvider.get(e.providerName);
      if (!existing || e.outputPerMillion < existing.outputPerMillion) {
        byProvider.set(e.providerName, e);
      }
    }
    const sorted = Array.from(byProvider.values()).sort(
      (a, b) => a.outputPerMillion - b.outputPerMillion,
    );

    const nebius = sorted.find((e) => e.providerName === "Nebius");
    if (!nebius) continue; // Only include models Nebius actively serves.
    const nebiusRank = sorted.indexOf(nebius) + 1;

    const endpoints: FieldEndpoint[] = sorted.map((e) => ({
      providerName: e.providerName,
      inputPerMillion: e.inputPerMillion,
      outputPerMillion: e.outputPerMillion,
      contextLength: e.contextLength,
      quantization: e.quantization || "—",
    }));

    comparisons.push({
      modelId,
      modelDisplay: displayShortName(modelId),
      endpoints,
      nebiusRank,
      nebiusOutput: nebius.outputPerMillion,
      nebiusQuant: nebius.quantization || "—",
      nebiusContext: nebius.contextLength,
      cheapestProvider: sorted[0].providerName,
      cheapestOutput: sorted[0].outputPerMillion,
      totalProviders: sorted.length,
    });
  }
  return comparisons.sort((a, b) => a.nebiusRank - b.nebiusRank);
}

// Normalize model identifiers so platform-mix entries match Nebius catalog entries
// regardless of casing, hyphen/underscore drift, or org prefix.
function normalizeId(id: string): string {
  return id.toLowerCase().replace(/[-_]/g, "").split("/").pop() || id.toLowerCase();
}

const CLOSED_PREFIXES = ["openai/", "anthropic/", "google/", "x-ai/"];

export default function NebiusPreviewPage() {
  const tokens = getTokenPricing();
  const waterfall = getWaterfall();
  const fieldComparisons = buildFieldComparisons(getProviderEndpoints());

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
    fieldComparisons,
  };

  return <NebiusPreview {...props} />;
}
