"use client";

import ExpandableChart from "./ui/ExpandableChart";
import type { TokenPriceModel } from "@/lib/data";

interface Props {
  tokenModels: TokenPriceModel[];
}

// Curated list of models people actually deploy and care about.
// Each entry resolves to up to two TokenPriceModel rows — one per source —
// matched by modelId substring (lowercased).
const CURATED: Array<{ label: string; openRouter?: string; nebius?: string; tier: "frontier" | "open" }> = [
  // Frontier closed-source (OpenRouter only)
  { label: "OpenAI o3 Pro",              openRouter: "openai/o3-pro",                                                        tier: "frontier" },
  { label: "Anthropic Claude Opus 4.6",  openRouter: "anthropic/claude-opus-4.6",                                            tier: "frontier" },
  { label: "Anthropic Claude Sonnet 4.6",openRouter: "anthropic/claude-sonnet-4.6",                                          tier: "frontier" },
  { label: "OpenAI GPT-5",               openRouter: "openai/gpt-5",                                                         tier: "frontier" },
  { label: "Google Gemini 2.5 Pro",      openRouter: "google/gemini-2.5-pro",                                                tier: "frontier" },
  { label: "Anthropic Claude Haiku 4.5", openRouter: "anthropic/claude-haiku-4.5",                                           tier: "frontier" },
  { label: "Google Gemini 2.5 Flash",    openRouter: "google/gemini-2.5-flash",                                              tier: "frontier" },
  { label: "OpenAI GPT-5 Mini",          openRouter: "openai/gpt-5-mini",                                                    tier: "frontier" },
  // Open-source (arbitrage candidates have both)
  { label: "Llama 4 Maverick",           openRouter: "meta-llama/llama-4-maverick",  nebius: "meta-llama/Llama-4-Maverick",  tier: "open" },
  { label: "DeepSeek V3.2",              openRouter: "deepseek/deepseek-v3.2",       nebius: "deepseek-ai/DeepSeek-V3.2",    tier: "open" },
  { label: "Llama 3.3 70B",              openRouter: "meta-llama/llama-3.3-70b-instruct", nebius: "meta-llama/Llama-3.3-70B-Instruct", tier: "open" },
  { label: "gpt-oss-120b",               openRouter: "openai/gpt-oss-120b",          nebius: "openai/gpt-oss-120b",          tier: "open" },
  { label: "Kimi K2.5",                  openRouter: "moonshotai/kimi-k2.5",         nebius: "moonshotai/Kimi-K2.5",         tier: "open" },
  { label: "MiniMax M2.5",               openRouter: "minimax/minimax-m2.5",         nebius: "MiniMaxAI/MiniMax-M2.5",       tier: "open" },
  { label: "Qwen3-32B",                  nebius: "Qwen/Qwen3-32B",                                                           tier: "open" },
];

const OR_COLOR = "#5BA9FF";
const NB_COLOR = "#A855F7";

const fmtPrice = (n: number) => parseFloat(n.toFixed(2)).toString();

function findRow(models: TokenPriceModel[], id: string | undefined, source: "OpenRouter" | "Nebius"): TokenPriceModel | undefined {
  if (!id) return undefined;
  const target = id.toLowerCase();
  return models.find((m) => m.modelId.toLowerCase() === target && (source === "Nebius" ? m.source === "Nebius" : !m.source));
}

export default function TokenPriceCharts({ tokenModels }: Props) {
  // Resolve curated list against the live data
  const resolved = CURATED.map((c) => ({
    label: c.label,
    tier: c.tier,
    or: findRow(tokenModels, c.openRouter, "OpenRouter"),
    nb: findRow(tokenModels, c.nebius, "Nebius"),
  })).filter((r) => r.or || r.nb);

  // ── Chart 1: Arbitrage (models with BOTH sources) ──
  const arbRows = resolved
    .filter((r) => r.or && r.nb)
    .map((r) => {
      const orPrice = r.or!.outputPerMillion;
      const nbPrice = r.nb!.outputPerMillion;
      const gapPct = orPrice > 0 ? ((nbPrice - orPrice) / orPrice) * 100 : 0;
      return { label: r.label, or: orPrice, nb: nbPrice, gapPct };
    })
    .sort((a, b) => Math.abs(b.gapPct) - Math.abs(a.gapPct));

  const arbMin = arbRows.length ? Math.min(...arbRows.flatMap((r) => [r.or, r.nb])) : 0;
  const arbMax = arbRows.length ? Math.max(...arbRows.flatMap((r) => [r.or, r.nb])) : 1;
  const arbScale = (p: number) => {
    if (arbMax === arbMin) return 50;
    return ((p - arbMin) / (arbMax - arbMin)) * 90 + 5; // 5%–95% of the bar
  };

  // ── Chart 2: Distribution (all curated, log scale) ──
  const distPoints = resolved.flatMap((r) => {
    const out: Array<{ label: string; tier: "frontier" | "open"; source: "OpenRouter" | "Nebius"; price: number }> = [];
    if (r.or) out.push({ label: r.label, tier: r.tier, source: "OpenRouter", price: r.or.outputPerMillion });
    if (r.nb) out.push({ label: r.label, tier: r.tier, source: "Nebius", price: r.nb.outputPerMillion });
    return out;
  });
  const allPrices = distPoints.map((p) => p.price).filter((p) => p > 0);
  const logMin = Math.log10(Math.min(...allPrices));
  const logMax = Math.log10(Math.max(...allPrices));
  const logScale = (p: number) => ((Math.log10(p) - logMin) / (logMax - logMin)) * 100;

  // Group distribution rows by model label so two-source models share a row
  const distByLabel: Record<string, typeof distPoints> = {};
  for (const p of distPoints) {
    (distByLabel[p.label] ||= []).push(p);
  }
  const distRows = resolved.map((r) => ({
    label: r.label,
    tier: r.tier,
    points: distByLabel[r.label] || [],
  }));

  const arbLegend = (
    <div className="flex gap-4 text-[10px] font-mono text-bep-muted">
      <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: OR_COLOR }} />OpenRouter</span>
      <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: NB_COLOR }} />Nebius</span>
      <span className="ml-auto">Positive markup = Nebius costs more than OpenRouter aggregate</span>
    </div>
  );

  const distLegend = (
    <div className="flex gap-4 text-[10px] font-mono text-bep-muted">
      <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: OR_COLOR }} />OpenRouter</span>
      <span><span className="inline-block w-2 h-2 rounded-full mr-1 align-middle" style={{ background: NB_COLOR }} />Nebius</span>
      <span><span className="text-[#A855F7]">Frontier</span> / <span className="text-[#76B900]">Open-source</span></span>
    </div>
  );

  return (
    <div className="space-y-4">
      {arbRows.length > 0 && (
        <ExpandableChart
          title="Same Model, Different Markets"
          subtitle="Output $/M when the same open-weight model is sold by both. The gap is the inference-provider markup."
          footer={arbLegend}
        >
          {() => (
            <div>
              <div className="grid mb-2 text-[9px] font-mono text-bep-muted uppercase tracking-widest" style={{ gridTemplateColumns: "1.4fr 3fr 0.8fr" }}>
                <span>Model</span><span></span><span className="text-right">Markup</span>
              </div>
              {arbRows.map((r) => {
                const orPos = arbScale(r.or);
                const nbPos = arbScale(r.nb);
                const left = Math.min(orPos, nbPos);
                const width = Math.abs(nbPos - orPos);
                const markupColor = r.gapPct > 0 ? "#FF4444" : r.gapPct < 0 ? "#76B900" : "#999";
                return (
                  <div key={r.label} className="grid items-center py-2 border-b border-bep-border last:border-0" style={{ gridTemplateColumns: "1.4fr 3fr 0.8fr" }}>
                    <span className="text-[11px] text-bep-white font-medium truncate pr-2">{r.label}</span>
                    <div className="relative h-6">
                      <div className="absolute top-1/2 -translate-y-1/2 h-px bg-bep-border" style={{ left: `${left}%`, width: `${width}%` }} />
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${orPos}%` }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: OR_COLOR, boxShadow: `0 0 0 1px ${OR_COLOR}33` }} />
                        <span className="absolute top-3 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap" style={{ color: OR_COLOR }}>${fmtPrice(r.or)}</span>
                      </div>
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${nbPos}%` }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: NB_COLOR, boxShadow: `0 0 0 1px ${NB_COLOR}33` }} />
                        <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[9px] font-mono whitespace-nowrap" style={{ color: NB_COLOR }}>${fmtPrice(r.nb)}</span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-semibold text-right" style={{ color: markupColor }}>
                      {r.gapPct > 0 ? "+" : ""}{r.gapPct.toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </ExpandableChart>
      )}

      <ExpandableChart
        title="Token Economics by Model"
        subtitle="Output $/M for the models people actually deploy. Log scale — frontier reasoning models occupy a different cost universe from open-source workhorses."
        footer={distLegend}
      >
        {() => (
          <div>
            <div className="relative h-4 mb-1 text-[9px] font-mono text-bep-muted">
              {[0.05, 0.1, 0.5, 1, 5, 10, 50, 100].filter(v => v >= Math.pow(10, logMin) * 0.5 && v <= Math.pow(10, logMax) * 2).map((tick) => (
                <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${logScale(tick)}%` }}>${tick}</span>
              ))}
            </div>
            <div className="space-y-1.5">
              {distRows.map((r) => (
                <div key={r.label} className="grid items-center" style={{ gridTemplateColumns: "1.4fr 3fr" }}>
                  <span className="text-[11px] font-medium truncate pr-2" style={{ color: r.tier === "frontier" ? "#A855F7" : "#76B900" }}>{r.label}</span>
                  <div className="relative h-4 bg-bep-bg rounded-sm">
                    {r.points.map((pt) => (
                      <div
                        key={pt.source}
                        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full"
                        style={{
                          left: `${logScale(pt.price)}%`,
                          background: pt.source === "Nebius" ? NB_COLOR : OR_COLOR,
                          boxShadow: `0 0 0 1px ${pt.source === "Nebius" ? NB_COLOR : OR_COLOR}33`,
                        }}
                        title={`${pt.source}: $${fmtPrice(pt.price)}/M output`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ExpandableChart>
    </div>
  );
}
