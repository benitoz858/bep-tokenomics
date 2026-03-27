import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

const OPENROUTER_API = "https://openrouter.ai/api/v1/models";

const TRACKED_MODELS = [
  // OpenAI
  "openai/gpt-5.4", "openai/gpt-5.4-mini", "openai/gpt-5.2",
  "openai/gpt-5", "openai/gpt-5-mini",
  "openai/o3", "openai/o3-pro", "openai/o3-mini",
  // Anthropic
  "anthropic/claude-opus-4.6", "anthropic/claude-sonnet-4.6",
  "anthropic/claude-haiku-4.5",
  // Google
  "google/gemini-2.5-pro", "google/gemini-2.5-flash",
  "google/gemini-2.0-flash-lite", "google/gemini-3-pro",
  // DeepSeek
  "deepseek/deepseek-v3.2", "deepseek/deepseek-r1",
  // xAI
  "x-ai/grok-4.1", "x-ai/grok-4.1-fast",
  // Meta
  "meta-llama/llama-4-maverick",
  // Mistral
  "mistralai/mistral-large", "mistralai/mistral-small",
];

interface OpenRouterModel {
  id: string;
  name?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  context_length?: number;
  top_provider?: {
    max_completion_tokens?: number;
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
}

function extractProvider(id: string): string {
  const prefix = id.split("/")[0];
  const map: Record<string, string> = {
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "google": "Google",
    "deepseek": "DeepSeek",
    "x-ai": "xAI",
    "meta-llama": "Meta",
    "mistralai": "Mistral",
  };
  return map[prefix] || prefix;
}

function extractModelName(id: string, name?: string): string {
  if (name) return name;
  return id.split("/").pop()?.replace(/-/g, " ") || id;
}

async function main() {
  console.log("Fetching OpenRouter model pricing...");

  const res = await fetch(OPENROUTER_API);
  if (!res.ok) throw new Error(`OpenRouter API error: ${res.status}`);

  const { data } = (await res.json()) as { data: OpenRouterModel[] };
  console.log(`Got ${data.length} models from OpenRouter`);

  const tracked: TokenPrice[] = [];

  for (const modelId of TRACKED_MODELS) {
    const model = data.find((m) => m.id === modelId);
    if (!model) {
      console.log(`  [skip] ${modelId} — not found`);
      continue;
    }

    const promptPrice = parseFloat(model.pricing?.prompt || "0");
    const completionPrice = parseFloat(model.pricing?.completion || "0");

    tracked.push({
      model: extractModelName(model.id, model.name),
      modelId: model.id,
      provider: extractProvider(model.id),
      inputPerMillion: promptPrice * 1_000_000,
      outputPerMillion: completionPrice * 1_000_000,
      contextWindow: model.context_length || 0,
      maxOutput: model.top_provider?.max_completion_tokens || null,
      fetchedAt: nowISO(),
    });

    console.log(
      `  [ok] ${model.id}: $${(promptPrice * 1_000_000).toFixed(2)} in / $${(completionPrice * 1_000_000).toFixed(2)} out`
    );
  }

  tracked.sort((a, b) => b.outputPerMillion - a.outputPerMillion);

  // Write current snapshot
  const currentPath = dataPath("token-pricing", "current.json");
  writeJSON(currentPath, {
    fetchedAt: nowISO(),
    modelCount: tracked.length,
    models: tracked,
  });

  // Append to history
  const historyPath = dataPath("token-pricing", "history.json");
  const history = readJSON<Record<string, unknown>>(historyPath) || { entries: {} };
  const entries = (history as { entries: Record<string, unknown> }).entries || {};
  const today = todayISO();
  (entries as Record<string, unknown>)[today] = tracked.map((t) => ({
    modelId: t.modelId,
    inputPerMillion: t.inputPerMillion,
    outputPerMillion: t.outputPerMillion,
  }));
  writeJSON(historyPath, { lastUpdated: today, entries });

  console.log(`\nDone. ${tracked.length} models tracked.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
