"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import { PROVIDER_COLORS } from "@/lib/calculations";

interface HistoryEntry {
  modelId: string;
  inputPerMillion: number;
  outputPerMillion: number;
}

interface Props {
  models: Array<{
    model: string;
    modelId?: string;
    provider: string;
    inputPerMillion: number;
    outputPerMillion: number;
    contextWindow: number;
  }>;
  llmflationIndex?: number;
  history?: Record<string, HistoryEntry[]>;
}

// Provider mapping for history entries
const MODEL_TO_PROVIDER: Record<string, string> = {
  "openai/": "OpenAI",
  "anthropic/": "Anthropic",
  "google/": "Google",
  "deepseek/": "DeepSeek",
  "x-ai/": "xAI",
  "meta-llama/": "Meta",
  "mistralai/": "Mistral",
};

function getProvider(modelId: string): string {
  for (const [prefix, provider] of Object.entries(MODEL_TO_PROVIDER)) {
    if (modelId.startsWith(prefix)) return provider;
  }
  return "Other";
}

function buildPriceHistory(history: Record<string, HistoryEntry[]>) {
  const dates = Object.keys(history).sort();
  const providers = ["OpenAI", "Anthropic", "Google", "DeepSeek"];

  return dates.map((date) => {
    const entries = history[date];
    const d = new Date(date);
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const row: Record<string, number | string | null> = { date: label };

    for (const provider of providers) {
      // Find the most expensive model from this provider (flagship proxy)
      const providerModels = entries.filter((e) => getProvider(e.modelId) === provider);
      const flagship = providerModels.sort((a, b) => b.outputPerMillion - a.outputPerMillion)[0];
      row[provider] = flagship?.outputPerMillion ?? null;
    }

    return row;
  });
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | null; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-bep-border2 rounded px-3 py-2 text-[11px] font-mono">
      <div className="text-bep-white mb-1">{label}</div>
      {payload.map((p, i) => p.value != null && (
        <div key={i} style={{ color: p.color }} className="mb-0.5">
          {p.name}: ${typeof p.value === "number" && p.value < 1 ? p.value.toFixed(2) : p.value}/M
        </div>
      ))}
    </div>
  );
}

export default function LLMflationCurve({ models, llmflationIndex, history }: Props) {
  const priceHistory = history && Object.keys(history).length > 0
    ? buildPriceHistory(history)
    : [];
  const sorted = [...models].sort((a, b) => b.outputPerMillion - a.outputPerMillion);
  const cheapestOutput = models.length ? models.reduce((min, m) => m.outputPerMillion < min.outputPerMillion ? m : min) : null;
  const premiumCeiling = sorted[0] || null;
  const spread = cheapestOutput && premiumCeiling && cheapestOutput.outputPerMillion > 0
    ? Math.round(premiumCeiling.outputPerMillion / cheapestOutput.outputPerMillion)
    : 0;

  return (
    <div>
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Metric
          label="LLMflation Index"
          value={llmflationIndex ? `${llmflationIndex.toFixed(1)}` : "~2.5"}
          sub="Base 100 = GPT-4 Mar 2023"
          color="#76B900"
        />
        <Metric
          label="Cheapest Output"
          value={cheapestOutput ? `$${cheapestOutput.outputPerMillion < 1 ? cheapestOutput.outputPerMillion.toFixed(2) : cheapestOutput.outputPerMillion.toFixed(0)}/M` : "—"}
          sub={cheapestOutput?.model || ""}
          color="#FF4444"
        />
        <Metric
          label="Premium Ceiling"
          value={premiumCeiling ? `$${premiumCeiling.outputPerMillion}/M` : "—"}
          sub={premiumCeiling?.model || ""}
          color="#A855F7"
        />
        <Metric
          label="Spread Ratio"
          value={spread ? `${spread}x` : "—"}
          sub="Premium / Cheapest"
          color="#00D4FF"
        />
      </div>

      <Section title="Frontier Model Output Pricing" subtitle="$/million output tokens by provider. The spread between premium and commodity is widening, not narrowing. That spread is the investment thesis.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="OpenAI" stroke={PROVIDER_COLORS.OpenAI} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Anthropic" stroke={PROVIDER_COLORS.Anthropic} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="Google" stroke={PROVIDER_COLORS.Google} strokeWidth={2} dot={{ r: 3 }} connectNulls />
              <Line type="monotone" dataKey="DeepSeek" stroke={PROVIDER_COLORS.DeepSeek} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <Section title="Current API Pricing Snapshot" subtitle="Sorted by output cost descending.">
        <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
          <div className="grid font-mono text-[10px] text-bep-muted uppercase tracking-wider px-3.5 py-2.5 border-b border-bep-border"
            style={{ gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.6fr" }}>
            <span>Model</span><span>Provider</span><span className="text-right">Input $/M</span><span className="text-right">Output $/M</span><span className="text-right">Context</span>
          </div>
          {sorted.map((p, i) => (
            <div key={p.model} className="grid px-3.5 py-2 text-xs border-b border-bep-border last:border-0"
              style={{
                gridTemplateColumns: "2fr 1.2fr 0.8fr 0.8fr 0.6fr",
                background: i % 2 === 0 ? "transparent" : "#0d0d0d"
              }}>
              <span className="text-bep-white font-medium">{p.model}</span>
              <span style={{ color: PROVIDER_COLORS[p.provider] || "#666" }}>{p.provider}</span>
              <span className="text-right text-bep-dim font-mono">${p.inputPerMillion < 1 ? p.inputPerMillion.toFixed(3) : p.inputPerMillion}</span>
              <span className="text-right text-bep-white font-mono font-semibold">${p.outputPerMillion < 1 ? p.outputPerMillion.toFixed(2) : p.outputPerMillion}</span>
              <span className="text-right text-bep-muted font-mono text-[10px]">{p.contextWindow ? `${Math.round(p.contextWindow / 1000)}K` : "—"}</span>
            </div>
          ))}
        </div>
      </Section>

      <InsightBox>
        The market is bifurcating. Commodity inference (DeepSeek, Flash-Lite) races toward zero. Premium inference (reasoning, multi-agent) commands {spread || 600}x the price. NVIDIA&apos;s LPX unlocks the premium tiers — that&apos;s where the margin lives. Track the spread, not the average.
      </InsightBox>
    </div>
  );
}
