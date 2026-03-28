"use client";

import { useState } from "react";
import LLMflationCurve from "./LLMflationCurve";
import TokenTiers from "./TokenTiers";
import RevenuePerWatt from "./RevenuePerWatt";
import InferenceMargin from "./InferenceMargin";
import JevonsParadox from "./JevonsParadox";
import TokenCostStack from "./TokenCostStack";
import GPUPriceTracker from "./GPUPriceTracker";
import TCOCalculator from "./TCOCalculator";
import InferenceProviderMargins from "./InferenceProviderMargins";
import SignalFeed from "./SignalFeed";
import type {
  TokenPriceModel,
  NVIDIATier,
  RevenuePerWattPlatform,
  CostStackComponent,
  GPUSummary,
  GPUThroughput,
  ModelInfo,
  TierHardware,
} from "@/lib/data";

const TABS = [
  { key: "llmflation", label: "LLMflation Curve" },
  { key: "tiers", label: "Token Tiers" },
  { key: "rpw", label: "Revenue / Watt" },
  { key: "margin", label: "Inference Margin" },
  { key: "jevons", label: "Jevons Paradox" },
  { key: "coststack", label: "Token Cost Stack" },
  { key: "gpu", label: "GPU Tracker" },
  { key: "tco", label: "Cluster TCO" },
  { key: "lab-margins", label: "Lab Margins" },
];

interface DashboardProps {
  tokenModels: TokenPriceModel[];
  tokenHistory: Record<string, Array<{ modelId: string; inputPerMillion: number; outputPerMillion: number }>>;
  llmflationIndex?: number;
  nvidiaTiers: NVIDIATier[];
  revenuePerWatt: { platforms: RevenuePerWattPlatform[]; derivation: { title: string; steps: string[] } };
  costStack: { components: CostStackComponent[]; insight: string };
  gpuPricing: { summaries: GPUSummary[]; source: string; fetchedAt: string; history: Record<string, GPUSummary[]> };
  gpuThroughput: Record<string, GPUThroughput>;
  throughputModels: ModelInfo[];
  tierHardware: Record<string, TierHardware>;
  lpxCostAdder: number;
  tcoProviders: never[];
  inferenceMarginData: unknown;
}

export default function Dashboard({
  tokenModels,
  llmflationIndex,
  nvidiaTiers,
  revenuePerWatt,
  costStack,
  gpuPricing,
  tokenHistory,
  gpuThroughput,
  throughputModels,
  tierHardware,
  lpxCostAdder,
  tcoProviders,
  inferenceMarginData,
}: DashboardProps) {
  const [tab, setTab] = useState("llmflation");

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      {/* Header */}
      <div className="px-6 pt-6 border-b border-bep-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="relative w-8 h-8 flex-shrink-0">
            <img src="/bep-icon.png" alt="BEP Research" width={32} height={32} style={{ filter: "brightness(1.2)", borderRadius: 4 }} />
            <div className="absolute inset-0 rounded" style={{ background: "linear-gradient(135deg, #76B90025, #00D4FF25)", mixBlendMode: "overlay" }} />
          </div>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-sans text-[20px] font-extrabold tracking-tight">The Stack</span>
              <span className="text-[10px] text-bep-muted font-mono tracking-widest">BEP RESEARCH</span>
            </div>
            <div className="text-[11px] text-bep-dim">
              AI infrastructure unit economics — live data by Ben Pouladian
            </div>
          </div>
        </div>
        <div className="flex overflow-x-auto gap-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="bg-transparent border-none cursor-pointer px-3.5 py-2 whitespace-nowrap text-xs transition-colors"
              style={{
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? "#f0f0f0" : "#666",
                borderBottom: tab === t.key ? "2px solid #76B900" : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-6 py-5 max-w-[900px]">
        <SignalFeed
          tokenModels={tokenModels}
          gpuSummaries={gpuPricing.summaries}
          llmflationIndex={llmflationIndex}
          fetchedAt={gpuPricing.fetchedAt}
        />
        {tab === "llmflation" && (
          <LLMflationCurve models={tokenModels} llmflationIndex={llmflationIndex} history={tokenHistory} />
        )}
        {tab === "tiers" && (
          <TokenTiers tiers={nvidiaTiers} />
        )}
        {tab === "rpw" && (
          <RevenuePerWatt platforms={revenuePerWatt.platforms} derivation={revenuePerWatt.derivation} />
        )}
        {tab === "margin" && (
          <InferenceMargin gpuPricing={gpuPricing.summaries} throughput={gpuThroughput} models={throughputModels} tierHardware={tierHardware} lpxCostAdder={lpxCostAdder} />
        )}
        {tab === "jevons" && (
          <JevonsParadox />
        )}
        {tab === "coststack" && (
          <TokenCostStack components={costStack.components} insight={costStack.insight} />
        )}
        {tab === "gpu" && (
          <GPUPriceTracker summaries={gpuPricing.summaries} source={gpuPricing.source} fetchedAt={gpuPricing.fetchedAt} history={gpuPricing.history} />
        )}
        {tab === "tco" && (
          <TCOCalculator providers={tcoProviders} />
        )}
        {tab === "lab-margins" && (
          <InferenceProviderMargins data={inferenceMarginData} />
        )}
      </div>

      {/* Watermark */}
      <div className="fixed bottom-2.5 right-4 text-[9px] font-mono tracking-widest" style={{ color: "rgba(102,102,102,0.25)" }}>
        BEP RESEARCH &copy; 2026
      </div>
    </div>
  );
}
