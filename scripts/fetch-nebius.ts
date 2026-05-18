import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

const NEBIUS_API = "https://api.tokenfactory.nebius.com/v1/models?verbose=true";
const TOKEN = process.env.NEBIUS_API_KEY;

interface NebiusModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

interface TokenPrice {
  model: string;
  modelId: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
  contextWindow: number;
  maxOutput: number | null;
  fetchedAt: string;
  source?: string;
}

interface CurrentFile {
  fetchedAt: string;
  modelCount: number;
  models: TokenPrice[];
}

function creatorFromId(id: string): string {
  const prefix = id.split("/")[0].toLowerCase();
  const map: Record<string, string> = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "deepseek": "DeepSeek",
    "meta-llama": "Meta",
    "meta": "Meta",
    "mistralai": "Mistral",
    "qwen": "Qwen",
    "nvidia": "NVIDIA",
    "microsoft": "Microsoft",
    "zai-org": "Z.ai",
    "z-ai": "Z.ai",
    "x-ai": "xAI",
    "moonshotai": "Moonshot",
  };
  return map[prefix] || prefix;
}

function displayName(id: string, name?: string): string {
  if (name) return name;
  return id.split("/").pop() || id;
}

async function main() {
  if (!TOKEN) {
    console.log("[Nebius] NEBIUS_API_KEY not set — skipping.");
    return;
  }

  console.log("Fetching Nebius Token Factory model pricing...");
  const res = await fetch(NEBIUS_API, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    console.error(`[Nebius] HTTP ${res.status} — ${await res.text().catch(() => "")}`);
    process.exit(1);
  }

  const { data } = (await res.json()) as { data: NebiusModel[] };
  console.log(`[Nebius] Got ${data.length} models`);

  const fetchedAt = nowISO();
  const added: TokenPrice[] = [];

  for (const m of data) {
    const prompt = parseFloat(m.pricing?.prompt || "0");
    const completion = parseFloat(m.pricing?.completion || "0");
    if (prompt === 0 && completion === 0) continue;

    added.push({
      model: displayName(m.id, m.name),
      modelId: m.id,
      provider: creatorFromId(m.id),
      inputPerMillion: prompt * 1_000_000,
      outputPerMillion: completion * 1_000_000,
      contextWindow: m.context_length || 0,
      maxOutput: null,
      fetchedAt,
      source: "Nebius",
    });

    console.log(`  [ok] ${m.id}: $${(prompt * 1_000_000).toFixed(2)} in / $${(completion * 1_000_000).toFixed(2)} out`);
  }

  const currentPath = dataPath("token-pricing", "current.json");
  const current = readJSON<CurrentFile>(currentPath);
  if (!current) {
    console.error("[Nebius] token-pricing/current.json missing — run fetch-openrouter first.");
    process.exit(1);
  }

  // Drop any prior Nebius rows so we don't accumulate duplicates day-over-day.
  const kept = current.models.filter((m) => m.source !== "Nebius");
  const merged = [...kept, ...added].sort((a, b) => b.outputPerMillion - a.outputPerMillion);

  writeJSON(currentPath, {
    fetchedAt: nowISO(),
    modelCount: merged.length,
    models: merged,
  });

  // Append today's Nebius snapshot to history alongside OpenRouter entries.
  const historyPath = dataPath("token-pricing", "history.json");
  interface HistoryEntry { modelId: string; inputPerMillion: number; outputPerMillion: number; source?: string }
  const history = readJSON<{ entries: Record<string, HistoryEntry[]> }>(historyPath) || { entries: {} };
  const today = todayISO();
  const existing = (history.entries[today] || []).filter((e) => e.source !== "Nebius");
  history.entries[today] = [
    ...existing,
    ...added.map((t) => ({ modelId: t.modelId, inputPerMillion: t.inputPerMillion, outputPerMillion: t.outputPerMillion, source: "Nebius" })),
  ];
  writeJSON(historyPath, { lastUpdated: today, entries: history.entries });

  console.log(`\n[Nebius] Done. Added ${added.length} models (table now has ${merged.length} total).`);
}

main().catch((err) => {
  console.error("[Nebius] Failed:", err);
  process.exit(1);
});
