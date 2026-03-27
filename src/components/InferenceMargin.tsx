"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, LineChart, Line, ComposedChart, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ReferenceLine } from "recharts";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import { GPU_DISPLAY_NAMES, TIER_COLORS, costPerMillionFromGPU, inferenceMargin, breakEvenUtilization } from "@/lib/calculations";
import type { GPUSummary, GPUThroughput, ModelInfo, TierHardware } from "@/lib/data";

const TIERS = [
  { tier: "Medium", price: 3 },
  { tier: "High", price: 6 },
  { tier: "Premium", price: 45 },
  { tier: "Ultra", price: 150 },
];

interface Props {
  gpuPricing: GPUSummary[];
  throughput: Record<string, GPUThroughput>;
  models: ModelInfo[];
  tierHardware: Record<string, TierHardware>;
  lpxCostAdder: number;
}

function MarginChart({ gpuOptions, throughput, selectedModel, selectedTier, tierHardware, lpxCostAdder, models }: {
  gpuOptions: GPUSummary[];
  throughput: Record<string, GPUThroughput>;
  selectedModel: string;
  selectedTier: string;
  tierHardware: Record<string, TierHardware>;
  lpxCostAdder: number;
  models: ModelInfo[];
}) {
  const tier = TIERS.find((t) => t.tier === selectedTier);
  const hwMode = tierHardware[selectedTier]?.mode || "gpuOnly";
  const isLPX = hwMode === "withLPX";
  const modelName = models.find((m) => m.id === selectedModel)?.name || selectedModel;

  const chartData = useMemo(() => {
    if (!tier) return [];
    return gpuOptions.map((gpu) => {
      const gpuData = throughput[gpu.gpuModel];
      if (!gpuData) return null;
      const profile = gpuData.profiles[selectedModel];
      if (!profile) return null;

      const tokPerSec = isLPX ? profile.withLPX : profile.gpuOnly;
      if (tokPerSec === null) return null;

      const basePrice = gpu.onDemand.median || gpu.spot.median || 0;
      const totalCost = isLPX ? basePrice + lpxCostAdder : basePrice;
      const costPerM = costPerMillionFromGPU(totalCost, tokPerSec);
      const margin = inferenceMargin(tier.price, costPerM);

      // GPU-only comparison
      const gpuOnlyTok = profile.gpuOnly;
      const gpuOnlyCostPerM = gpuOnlyTok ? costPerMillionFromGPU(basePrice, gpuOnlyTok) : null;
      const gpuOnlyMargin = gpuOnlyCostPerM !== null ? inferenceMargin(tier.price, gpuOnlyCostPerM) : null;

      return {
        name: GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel,
        costPerM: Math.round(costPerM * 100) / 100,
        margin: Math.round(margin * 10) / 10,
        tokPerSec,
        sellPrice: tier.price,
        gpuOnlyCostPerM: gpuOnlyCostPerM !== null ? Math.round(gpuOnlyCostPerM * 100) / 100 : null,
        gpuOnlyMargin: gpuOnlyMargin !== null ? Math.round(gpuOnlyMargin * 10) / 10 : null,
      };
    }).filter(Boolean) as Array<{
      name: string; costPerM: number; margin: number; tokPerSec: number; sellPrice: number;
      gpuOnlyCostPerM: number | null; gpuOnlyMargin: number | null;
    }>;
  }, [gpuOptions, throughput, selectedModel, tier, isLPX, lpxCostAdder]);

  if (chartData.length === 0) return null;

  return (
    <Section
      title="Cost vs Margin by GPU"
      subtitle={`Serving ${modelName} at ${selectedTier} tier ($${tier?.price}/M). Bars = production cost/M tokens (left). Line = inference margin % (right).${isLPX ? " With LPX decode." : ""}`}
    >
      <div className="bg-bep-card border border-bep-border rounded-md p-4">
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
            <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} />
            <YAxis
              yAxisId="cost"
              orientation="left"
              tick={{ fill: "#FF4444", fontSize: 10 }}
              tickFormatter={(v: number) => `$${v}`}
              label={{ value: "Cost $/M tokens", angle: -90, position: "insideLeft", fill: "#FF4444", fontSize: 10, dx: -10 }}
            />
            <YAxis
              yAxisId="margin"
              orientation="right"
              tick={{ fill: "#76B900", fontSize: 10 }}
              tickFormatter={(v: number) => `${v}%`}
              domain={[-100, 100]}
              label={{ value: "Margin %", angle: 90, position: "insideRight", fill: "#76B900", fontSize: 10, dx: 10 }}
            />
            <Tooltip
              contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
              formatter={(value, name) => {
                const v = Number(value);
                if (name === "Cost/M tokens" || name === "GPU-only cost") return [`$${v.toFixed(2)}`, name];
                if (name === "Margin %" || name === "GPU-only margin") return [`${v.toFixed(1)}%`, name];
                return [value, name];
              }}
            />
            <ReferenceLine yAxisId="margin" y={0} stroke="#666" strokeDasharray="3 3" />
            <ReferenceLine yAxisId="cost" y={tier?.price || 0} stroke="#76B90060" strokeDasharray="5 5" label={{ value: `Sell: $${tier?.price}`, fill: "#76B900", fontSize: 10, position: "top" }} />
            {isLPX && (
              <Bar yAxisId="cost" dataKey="gpuOnlyCostPerM" name="GPU-only cost" fill="#FF444430" barSize={20} radius={[2, 2, 0, 0]} />
            )}
            <Bar yAxisId="cost" dataKey="costPerM" name="Cost/M tokens" barSize={isLPX ? 20 : 35} radius={[4, 4, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.margin > 0 ? "#FF444480" : "#FF4444"} />
              ))}
            </Bar>
            {isLPX && (
              <Line yAxisId="margin" type="monotone" dataKey="gpuOnlyMargin" name="GPU-only margin" stroke="#666" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: "#666" }} />
            )}
            <Line yAxisId="margin" type="monotone" dataKey="margin" name="Margin %" stroke="#76B900" strokeWidth={2.5} dot={{ r: 5, fill: "#76B900", stroke: "#050505", strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
        <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted justify-center">
          <span><span className="text-bep-red">■</span> Cost to produce</span>
          <span><span className="text-bep-green">●─</span> Margin %</span>
          {isLPX && <span><span className="text-[#666]">■</span> GPU-only cost</span>}
          {isLPX && <span><span className="text-[#666]">●┄</span> GPU-only margin</span>}
          <span><span className="text-bep-green" style={{ opacity: 0.4 }}>┄┄</span> Sell price</span>
        </div>
      </div>
    </Section>
  );
}

export default function InferenceMargin({ gpuPricing, throughput, models, tierHardware, lpxCostAdder }: Props) {
  const gpuOptions = gpuPricing.filter((g) => throughput[g.gpuModel]);
  const [selectedGpu, setSelectedGpu] = useState(gpuOptions[0]?.gpuModel || "nvidia-h100");
  const [selectedModel, setSelectedModel] = useState("llama-70b");
  const [selectedTier, setSelectedTier] = useState("Premium");

  // Check if selected GPU supports LPX at all
  const gpuSupportsLPX = useMemo(() => {
    const gpuData = throughput[selectedGpu];
    if (!gpuData) return false;
    return Object.values(gpuData.profiles).some((p) => p.withLPX !== null);
  }, [selectedGpu, throughput]);

  // Auto-downgrade to GPU-only tier if accelerator doesn't support LPX
  const effectiveTier = (!gpuSupportsLPX && tierHardware[selectedTier]?.mode === "withLPX")
    ? "High"
    : selectedTier;
  const hwMode = tierHardware[effectiveTier]?.mode || "gpuOnly";
  const isLPX = hwMode === "withLPX";

  // Filter models to those that can run on the selected GPU in the selected mode
  const availableModels = useMemo(() => {
    const gpuData = throughput[selectedGpu];
    if (!gpuData) return [];
    return models.filter((m) => {
      const profile = gpuData.profiles[m.id];
      if (!profile) return false;
      const tok = isLPX ? profile.withLPX : profile.gpuOnly;
      return tok !== null;
    });
  }, [selectedGpu, throughput, models, isLPX]);

  // Reset model if it can't run in current config
  useMemo(() => {
    const gpuData = throughput[selectedGpu];
    if (!gpuData) return;
    const profile = gpuData.profiles[selectedModel];
    const tok = profile ? (isLPX ? profile.withLPX : profile.gpuOnly) : null;
    if (tok === null) {
      const first = availableModels[0];
      if (first) setSelectedModel(first.id);
    }
  }, [selectedGpu, throughput, selectedModel, isLPX, availableModels]);

  const calc = useMemo(() => {
    const gpu = gpuPricing.find((g) => g.gpuModel === selectedGpu);
    const gpuData = throughput[selectedGpu];
    const tier = TIERS.find((t) => t.tier === effectiveTier);
    if (!gpu || !gpuData || !tier) return null;

    const profile = gpuData.profiles[selectedModel];
    if (!profile) return null;

    const tokPerSec = isLPX ? profile.withLPX : profile.gpuOnly;
    if (tokPerSec === null) return null;

    const modelInfo = models.find((m) => m.id === selectedModel);
    const baseGpuCost = gpu.onDemand.median || gpu.spot.median || 0;
    const priceType = gpu.onDemand.median ? "on-demand" : "spot";
    const totalCostPerHour = isLPX ? baseGpuCost + lpxCostAdder : baseGpuCost;
    const costPerM = costPerMillionFromGPU(totalCostPerHour, tokPerSec);
    const margin = inferenceMargin(tier.price, costPerM);
    const breakEven = breakEvenUtilization(tier.price, costPerM);

    // GPU-only comparison for the same model
    const gpuOnlyTok = profile.gpuOnly;
    const gpuOnlyCostPerM = gpuOnlyTok ? costPerMillionFromGPU(baseGpuCost, gpuOnlyTok) : null;

    return {
      gpuName: GPU_DISPLAY_NAMES[selectedGpu] || selectedGpu,
      baseGpuCost,
      lpxAdder: isLPX ? lpxCostAdder : 0,
      totalCostPerHour,
      priceType,
      tokPerSec,
      gpuOnlyTokPerSec: gpuOnlyTok,
      modelName: modelInfo?.name || selectedModel,
      modelParams: modelInfo?.params || "",
      quantization: profile.quantization,
      note: profile.note,
      costPerM,
      gpuOnlyCostPerM,
      revenuePerM: tier.price,
      margin,
      breakEven,
      isLPX,
      hwLabel: tierHardware[selectedTier]?.label || "GPU only",
    };
  }, [selectedGpu, selectedModel, effectiveTier, gpuPricing, throughput, models, isLPX, lpxCostAdder, tierHardware]);

  return (
    <div>
      <Section title="Inference Margin Calculator" subtitle="Pick a GPU, model, and pricing tier. Premium/Ultra tiers activate LPX decode acceleration — throughput jumps 3-5x, changing the entire margin picture.">
        <div className="bg-bep-card border border-bep-border rounded-md p-5">
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-2 font-mono">GPU</label>
              <select
                value={selectedGpu}
                onChange={(e) => setSelectedGpu(e.target.value)}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-3 py-2 text-sm text-bep-white font-mono focus:border-bep-green focus:outline-none"
              >
                {gpuOptions.map((g) => {
                  const price = g.onDemand.median || g.spot.median;
                  const type = g.onDemand.median ? "on-demand" : "spot";
                  return (
                    <option key={g.gpuModel} value={g.gpuModel}>
                      {GPU_DISPLAY_NAMES[g.gpuModel] || g.gpuModel} — ${price?.toFixed(2) || "?"}/hr ({type})
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-2 font-mono">Model Being Served</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-3 py-2 text-sm text-bep-white font-mono focus:border-bep-green focus:outline-none"
              >
                {availableModels.map((m) => {
                  const profile = throughput[selectedGpu]?.profiles[m.id];
                  const tok = profile ? (isLPX ? profile.withLPX : profile.gpuOnly) : null;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} — {tok} tok/s{isLPX ? " (w/ LPX)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-2 font-mono">Token Tier</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-3 py-2 text-sm text-bep-white font-mono focus:border-bep-green focus:outline-none"
              >
                {TIERS.map((t) => {
                  const hw = tierHardware[t.tier];
                  return (
                    <option key={t.tier} value={t.tier}>
                      {t.tier} — ${t.price}/M {hw?.mode === "withLPX" ? "(GPU+LPX)" : "(GPU only)"}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Hardware mode indicator */}
          <div className={`text-[11px] font-mono px-3 py-1.5 rounded mb-4 border ${isLPX ? "bg-[#76B90015] border-[#76B90040] text-bep-green" : "bg-bep-bg border-bep-border text-bep-dim"}`}>
            {isLPX ? (
              <>LPX Active — GPU handles prefill, Groq LPX handles decode. Throughput ~3-5x vs GPU-only. +${lpxCostAdder.toFixed(2)}/hr LPX cost added.</>
            ) : (
              <>GPU Only — standard inference, no decode acceleration.</>
            )}
          </div>
          {!gpuSupportsLPX && tierHardware[selectedTier]?.mode === "withLPX" && (
            <div className="text-[11px] font-mono px-3 py-1.5 rounded mb-4 border bg-[#FFB80010] border-[#FFB80040] text-bep-amber">
              {GPU_DISPLAY_NAMES[selectedGpu] || selectedGpu} does not support LPX decode. Showing GPU-only economics at High tier ($6/M). NVIDIA GPUs required for Premium/Ultra pricing.
            </div>
          )}

          {calc && (
            <div className="space-y-3">
              {calc.note && (
                <div className="text-[11px] text-bep-amber font-mono bg-bep-bg border border-bep-border rounded px-3 py-1.5">
                  {calc.note}
                </div>
              )}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-bep-bg border border-bep-border rounded p-3 text-center">
                  <div className="text-[10px] text-bep-muted uppercase tracking-wider mb-1 font-mono">Total Cost</div>
                  <div className="text-lg font-bold font-mono text-bep-amber">${calc.totalCostPerHour.toFixed(2)}/hr</div>
                  <div className="text-[10px] text-bep-dim">
                    {calc.isLPX ? (
                      <>{calc.gpuName} ${calc.baseGpuCost.toFixed(2)} + LPX ${calc.lpxAdder.toFixed(2)}</>
                    ) : (
                      <>{calc.gpuName} {calc.priceType}</>
                    )}
                  </div>
                </div>
                <div className="bg-bep-bg border border-bep-border rounded p-3 text-center">
                  <div className="text-[10px] text-bep-muted uppercase tracking-wider mb-1 font-mono">Throughput</div>
                  <div className="text-lg font-bold font-mono text-bep-cyan">{calc.tokPerSec} tok/s</div>
                  <div className="text-[10px] text-bep-dim">
                    {calc.isLPX && calc.gpuOnlyTokPerSec ? (
                      <span className="text-bep-green">{(calc.tokPerSec / calc.gpuOnlyTokPerSec).toFixed(1)}x vs GPU-only ({calc.gpuOnlyTokPerSec})</span>
                    ) : (
                      <>{calc.modelName} ({calc.quantization})</>
                    )}
                  </div>
                </div>
                <div className="bg-bep-bg border border-bep-border rounded p-3 text-center">
                  <div className="text-[10px] text-bep-muted uppercase tracking-wider mb-1 font-mono">Cost to Produce</div>
                  <div className="text-lg font-bold font-mono text-bep-red">${calc.costPerM.toFixed(2)}/M</div>
                  <div className="text-[10px] text-bep-dim">
                    {calc.isLPX && calc.gpuOnlyCostPerM ? (
                      <span className="text-bep-green">{((1 - calc.costPerM / calc.gpuOnlyCostPerM) * 100).toFixed(0)}% cheaper than GPU-only (${calc.gpuOnlyCostPerM.toFixed(2)})</span>
                    ) : (
                      <>per million output tokens</>
                    )}
                  </div>
                </div>
                <div className="bg-bep-bg border border-bep-border rounded p-3 text-center">
                  <div className="text-[10px] text-bep-muted uppercase tracking-wider mb-1 font-mono">Sell Price</div>
                  <div className="text-lg font-bold font-mono text-bep-green">${calc.revenuePerM}/M</div>
                  <div className="text-[10px] text-bep-dim">{selectedTier} tier — {calc.hwLabel}</div>
                </div>
              </div>

              <div className="bg-bep-bg border-2 rounded-md p-4 text-center" style={{ borderColor: calc.margin > 50 ? "#76B900" : calc.margin > 0 ? "#FFB800" : "#FF4444" }}>
                <div className="text-[10px] text-bep-muted uppercase tracking-widest mb-1 font-mono">Inference Margin</div>
                <div className="text-4xl font-black font-mono" style={{ color: calc.margin > 50 ? "#76B900" : calc.margin > 0 ? "#FFB800" : "#FF4444" }}>
                  {calc.margin.toFixed(1)}%
                </div>
                <div className="text-xs text-bep-dim mt-1">
                  Revenue ${calc.revenuePerM}/M &minus; Cost ${calc.costPerM.toFixed(2)}/M = ${(calc.revenuePerM - calc.costPerM).toFixed(2)}/M profit
                </div>
                <div className="text-[10px] text-bep-muted mt-2 font-mono">
                  Break-even utilization: {calc.breakEven.toFixed(1)}%
                </div>
              </div>
            </div>
          )}

          {!calc && selectedGpu && (
            <div className="text-center text-bep-muted text-sm py-8 font-mono">
              {isLPX ? "This GPU/model combo doesn't support LPX decode. Try a GPU-only tier or a different GPU." : "Selected model cannot run on this GPU."}
            </div>
          )}
        </div>
      </Section>

      {/* Dual-axis chart: Cost vs Margin across GPUs */}
      <MarginChart
        gpuOptions={gpuOptions}
        throughput={throughput}
        selectedModel={selectedModel}
        selectedTier={selectedTier}
        tierHardware={tierHardware}
        lpxCostAdder={lpxCostAdder}
        models={models}
      />

      {/* Margin Matrix — GPU-only vs LPX side by side for selected model */}
      <Section title="GPU-Only vs GPU+LPX Margin Comparison" subtitle={`Serving ${models.find(m => m.id === selectedModel)?.name || selectedModel}. See how LPX decode acceleration transforms margins at every tier.`}>
        <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
          <div className="grid font-mono text-[10px] text-bep-muted uppercase tracking-wider px-3.5 py-2.5 border-b border-bep-border"
            style={{ gridTemplateColumns: "1.2fr 0.7fr 0.7fr 0.8fr repeat(4, 1fr)" }}>
            <span>GPU</span><span className="text-right">$/hr</span><span className="text-right">tok/s</span><span className="text-right">Cost/M</span>
            {TIERS.map((t) => (
              <span key={t.tier} className="text-right" style={{ color: TIER_COLORS[t.tier] }}>{t.tier}</span>
            ))}
          </div>
          {gpuOptions.map((gpu, idx) => {
            const gpuData = throughput[gpu.gpuModel];
            if (!gpuData) return null;
            const profile = gpuData.profiles[selectedModel];
            if (!profile) return null;

            const basePrice = gpu.onDemand.median || gpu.spot.median || 0;
            const rows: Array<{ label: string; costPerHour: number; tokPerSec: number | null; isLpx: boolean }> = [];

            if (profile.gpuOnly !== null) {
              rows.push({ label: "GPU", costPerHour: basePrice, tokPerSec: profile.gpuOnly, isLpx: false });
            }
            if (profile.withLPX !== null) {
              rows.push({ label: "+LPX", costPerHour: basePrice + lpxCostAdder, tokPerSec: profile.withLPX, isLpx: true });
            }

            if (rows.length === 0) return null;

            return rows.map((row, i) => {
              const costPerM = row.tokPerSec ? costPerMillionFromGPU(row.costPerHour, row.tokPerSec) : 0;
              return (
                <div key={`${gpu.gpuModel}-${row.label}`} className="grid px-3.5 py-1.5 text-xs border-b border-bep-border last:border-0"
                  style={{
                    gridTemplateColumns: "1.2fr 0.7fr 0.7fr 0.8fr repeat(4, 1fr)",
                    background: row.isLpx ? "#76B90008" : idx % 2 === 0 ? "transparent" : "#0d0d0d"
                  }}>
                  <span className="font-mono" style={{ color: row.isLpx ? "#76B900" : "#f0f0f0", fontWeight: i === 0 ? 500 : 400 }}>
                    {i === 0 ? (GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel) : ""} <span className="text-[10px]" style={{ color: row.isLpx ? "#76B900" : "#666" }}>{row.label}</span>
                  </span>
                  <span className="text-right text-bep-amber font-mono">${row.costPerHour.toFixed(2)}</span>
                  <span className="text-right font-mono" style={{ color: row.isLpx ? "#76B900" : "#00D4FF" }}>{row.tokPerSec}</span>
                  <span className="text-right text-bep-dim font-mono">${costPerM.toFixed(2)}</span>
                  {TIERS.map((t) => {
                    const tierMode = tierHardware[t.tier]?.mode || "gpuOnly";
                    // Gray out if tier requires LPX but this row is GPU-only (or vice versa)
                    const mismatch = (tierMode === "withLPX" && !row.isLpx) || (tierMode === "gpuOnly" && row.isLpx);
                    const margin = inferenceMargin(t.price, costPerM);
                    return (
                      <span key={t.tier} className="text-right font-mono font-semibold" style={{
                        color: mismatch ? "#333" : margin > 50 ? "#76B900" : margin > 0 ? "#FFB800" : "#FF4444",
                        opacity: mismatch ? 0.4 : 1,
                      }}>
                        {margin.toFixed(0)}%
                      </span>
                    );
                  })}
                </div>
              );
            });
          })}
        </div>
        <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted">
          <span>Bright = tier matches hardware config</span>
          <span>Dim = tier/hardware mismatch (not realistic combo)</span>
        </div>
      </Section>

      <InsightBox>
        This is the whole story. Switch between Claude Opus and a small 7B model — watch how LPX transforms the economics. A B200 serving Claude Opus at GPU-only gets ~$5/M cost. Add LPX, throughput triples, cost drops to ~$1.80/M — suddenly Premium tier ($45/M) is 96% margin instead of 87%. Same datacenter, same power, dramatically different economics. That&apos;s why Jensen said LPX is additive TAM, not replacement.
      </InsightBox>
    </div>
  );
}
