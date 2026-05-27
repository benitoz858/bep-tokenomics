// Fetch per-provider pricing + uptime for the tracked open-weights models from
// OpenRouter's endpoints API. Powers /tokenomics/providers — the competitive
// map showing where each open model is hosted and at what price.
//
// API: GET https://openrouter.ai/api/v1/models/{author}/{slug}/endpoints
// Returns: { data: { id, endpoints: [{ provider_name, pricing, context_length, ... }] } }
//
// This script is best-effort: any single model that fails to fetch is skipped
// (the page renders fine without it), and the script never throws a hard error
// so the daily cron doesn't break on one bad model.

import { dataPath, writeJSON, nowISO } from "./utils";

const ENDPOINTS_API = (id: string) => `https://openrouter.ai/api/v1/models/${id}/endpoints`;

// Same open-weights models tracked in fetch-openrouter.ts for cross-provider
// comparison. Keep this in sync with that list manually — small set, low churn.
const TRACKED_OPEN_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-4-maverick",
  "deepseek/deepseek-v3.2",
  "deepseek/deepseek-r1",
  "moonshotai/kimi-k2.5",
  "moonshotai/kimi-k2.6",
  "minimax/minimax-m2.5",
  "openai/gpt-oss-120b",
  "mistralai/mistral-large",
  "qwen/qwen3-32b",
  "qwen/qwen3-30b-a3b-instruct-2507",
  "qwen/qwen3-next-80b-a3b-thinking",
  "qwen/qwen3-235b-a22b-instruct-2507",
  "qwen/qwen3.5-397b-a17b",
  "qwen/qwen2.5-vl-72b-instruct",
  "google/gemma-3-27b-it",
  "nvidia/nemotron-3-super-120b-a12b",
];

interface RawEndpoint {
  name?: string;
  provider_name?: string;
  context_length?: number;
  max_completion_tokens?: number | null;
  pricing?: { prompt?: string; completion?: string };
  quantization?: string | null;
  uptime_last_30m?: number | null;
  status?: number | null;
}

interface Endpoint {
  providerName: string;
  contextLength: number;
  maxCompletion: number | null;
  inputPerMillion: number;
  outputPerMillion: number;
  quantization: string | null;
  uptime30m: number | null;
}

interface ProviderEndpointsFile {
  fetchedAt: string;
  modelCount: number;
  models: Record<string, { endpoints: Endpoint[] }>;
}

function normalizeEndpoint(e: RawEndpoint): Endpoint | null {
  const promptStr = e.pricing?.prompt ?? "0";
  const completionStr = e.pricing?.completion ?? "0";
  const prompt = parseFloat(promptStr);
  const completion = parseFloat(completionStr);
  if (!isFinite(prompt) || !isFinite(completion)) return null;
  if (completion <= 0) return null; // skip embedding / non-generative endpoints
  return {
    providerName: e.provider_name || e.name || "Unknown",
    contextLength: e.context_length || 0,
    maxCompletion: e.max_completion_tokens ?? null,
    inputPerMillion: prompt * 1_000_000,
    outputPerMillion: completion * 1_000_000,
    quantization: e.quantization ?? null,
    uptime30m: typeof e.uptime_last_30m === "number" ? e.uptime_last_30m : null,
  };
}

async function fetchEndpoints(modelId: string): Promise<Endpoint[] | null> {
  try {
    const res = await fetch(ENDPOINTS_API(modelId));
    if (!res.ok) {
      console.log(`  [skip] ${modelId} — HTTP ${res.status}`);
      return null;
    }
    const body = (await res.json()) as { data?: { endpoints?: RawEndpoint[] } };
    const endpoints = body.data?.endpoints ?? [];
    const out: Endpoint[] = [];
    for (const e of endpoints) {
      const n = normalizeEndpoint(e);
      if (n) out.push(n);
    }
    return out.sort((a, b) => a.outputPerMillion - b.outputPerMillion);
  } catch (err) {
    console.log(`  [skip] ${modelId} — ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  console.log("Fetching OpenRouter per-provider endpoints for tracked open models...");
  const out: ProviderEndpointsFile = { fetchedAt: nowISO(), modelCount: 0, models: {} };
  for (const id of TRACKED_OPEN_MODELS) {
    const endpoints = await fetchEndpoints(id);
    if (!endpoints || endpoints.length === 0) continue;
    out.models[id] = { endpoints };
    out.modelCount += 1;
    console.log(`  [ok] ${id} — ${endpoints.length} providers`);
  }
  writeJSON(dataPath("token-pricing", "provider-endpoints.json"), out);
  console.log(`\n[provider-endpoints] Done. ${out.modelCount} models, file written.`);
}

main().catch((err) => {
  // Best-effort: don't break the cron if OpenRouter is flaky.
  console.error("[provider-endpoints] Non-fatal failure:", err);
});
