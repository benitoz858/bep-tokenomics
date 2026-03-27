"use client";

import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, ComposedChart, Line } from "recharts";
import Section from "./ui/Section";
import Metric from "./ui/Metric";
import InsightBox from "./ui/InsightBox";
import { GPU_DISPLAY_NAMES } from "@/lib/calculations";

/* eslint-disable @typescript-eslint/no-explicit-any */

const TIER_COLORS: Record<string, string> = {
  "gold-neocloud": "#76B900",
  "silver-neocloud": "#00D4FF",
  "hyperscaler": "#FF4444",
  "neocloud-adjacent": "#FFB800",
  "spot-market": "#A855F7",
};

const ENGINEER_RATE = 200; // $/hr, industry standard rate for cloud infrastructure engineers

// Approximate tokens/sec/GPU throughput for inference (public benchmarks, BEP Research estimates)
const GPU_THROUGHPUT_TOKENS_PER_SEC: Record<string, number> = {
  "nvidia-h100": 2800,
  "nvidia-h200": 4200,
  "nvidia-b200": 9500,
  "nvidia-b300": 12000,
  "nvidia-gb200": 11000,
  "nvidia-gb300": 14000,
};

interface Props {
  providers: any[];
}

function computeTCO(provider: any, config: {
  gpuModel: string; gpuCount: number; months: number;
  storageHotTb: number; storageColdTb: number;
  jobSizeGpus: number; checkpointMin: number; initMin: number; blastRadius: number;
  faultTolerant: boolean;
}) {
  const gpuPrice = provider.gpuPricing?.[config.gpuModel];
  if (!gpuPrice) return null;

  const f = provider.tcoFactors;
  const hoursPerMonth = 720;
  const totalGpuHoursPerMonth = config.gpuCount * hoursPerMonth;

  // 1. GPU cost
  const gpuMonthly = gpuPrice * totalGpuHoursPerMonth;

  // 2. Storage (hot + cold)
  const hotGib = config.storageHotTb * 1024;
  const coldGib = config.storageColdTb * 1024;
  const hotRate = f.storageHotPerGibMonth || f.storageWarmPerGibMonth || 0.07;
  const coldRate = f.storageColdPerGibMonth || 0.012;
  const storageMonthly = (hotGib * hotRate) + (coldGib * coldRate);

  // 3. Networking
  let networkMonthly = 0;
  if (!f.networkingIncluded) {
    const egressGib = config.storageHotTb * 100; // rough estimate
    networkMonthly += (f.networkEgressPerGibMonth || 0) * egressGib;
    networkMonthly += (f.networkPublicIpPerHr || 0) * hoursPerMonth;
    networkMonthly += (f.networkNatGatewayPerHr || 0) * 2 * hoursPerMonth; // 2 gateways
    networkMonthly += (f.networkNatProcessingPerGib || 0) * 1024; // 1TB processed
    networkMonthly += (f.networkDataTransferPerGibMonth || 0) * 500 * 1024; // 500TB transfer
  }

  // 4. Control Plane
  let controlPlaneMonthly = 0;
  if (!f.controlPlaneIncluded && f.controlPlaneCostPerVm) {
    controlPlaneMonthly = f.controlPlaneCostPerVm * 3 * hoursPerMonth; // 3 VMs
  }

  // 5. Support (% uplift on everything above)
  const subtotalBeforeSupport = gpuMonthly + storageMonthly + networkMonthly + controlPlaneMonthly;
  const supportMonthly = subtotalBeforeSupport * (f.supportPct / 100);

  // 6. Goodput (cluster spend lost to downtime)
  const mtbf = f.mtbfGpuHours || 25000;
  const failuresPerMonth = totalGpuHoursPerMonth / mtbf;
  const tId = (f.failureIdentifyMinutes || 15) / 60; // hours
  const tChkpt = config.checkpointMin / 60;
  const tInit = config.initMin / 60;
  const tRepair = (f.repairReplaceMinutes || 15) / 60;

  let goodputLostHours: number;
  if (config.faultTolerant) {
    // G_tolerant: (t_id + t_failover) × j_size + t_repair × b_radius
    const tFailover = (f.hotSpares ? 5 : tInit * 60) / 60; // 5 min if hot spares, else init time
    goodputLostHours = ((tId + tFailover) * config.jobSizeGpus + tRepair * config.blastRadius) * failuresPerMonth;
  } else if (f.hotSpares) {
    // G_restart: [(t_id + t_chkpt/2) + t_init] × j_size + t_repair × b_radius
    goodputLostHours = (((tId + tChkpt / 2) + tInit) * config.jobSizeGpus + tRepair * config.blastRadius) * failuresPerMonth;
  } else {
    // G_wait: (t_id + t_chkpt/2) + t_init + t_repair) × j_size
    goodputLostHours = ((tId + tChkpt / 2) + tInit + tRepair) * config.jobSizeGpus * failuresPerMonth;
  }
  const goodputLossPct = (goodputLostHours / totalGpuHoursPerMonth) * 100;
  const goodputMonthly = gpuMonthly * (goodputLossPct / 100);

  // 7. Setup (amortized over contract)
  const setupEngineers = f.setupEngineers || 0;
  const setupWeeks = f.setupWeeks || 0;
  const setupPocMonths = f.setupPocMonths || 0;
  const pocCost = f.setupPocFree ? 0 : setupPocMonths * gpuPrice * config.gpuCount * hoursPerMonth;
  const setupEngineeringCost = setupEngineers * setupWeeks * 40 * ENGINEER_RATE;
  const totalSetupCost = pocCost + setupEngineeringCost;
  const setupMonthly = totalSetupCost / Math.max(config.months, 1);

  // 8. Debugging (ongoing)
  const debugEngineers = f.debuggingEngineersPerMonth || 0;
  const debugWeeksPerMonth = f.debuggingWeeksPerMonth || 0;
  const debugMonthly = debugEngineers * debugWeeksPerMonth * 40 * ENGINEER_RATE;

  const totalMonthly = gpuMonthly + storageMonthly + networkMonthly + controlPlaneMonthly + supportMonthly + goodputMonthly + setupMonthly + debugMonthly;

  // BEP Research unique metric: TCO per million tokens
  // Connects infrastructure TCO to token economics
  const effectivePerGpuHr = totalMonthly / totalGpuHoursPerMonth;
  const throughputTokPerSec = GPU_THROUGHPUT_TOKENS_PER_SEC[config.gpuModel] || 3000;
  const tokensPerHour = throughputTokPerSec * 3600;
  const tcoPerMillionTokens = (effectivePerGpuHr / tokensPerHour) * 1_000_000;

  return {
    provider: provider.name,
    providerId: provider.id,
    tier: provider.tier,
    bepTier: provider.bepTier,
    gpuPrice,
    totalMonthly,
    totalYearly: totalMonthly * 12,
    totalContract: totalMonthly * config.months,
    effectivePerGpuHr,
    tcoPerMillionTokens,
    tcoMultiplier: 0, // set later relative to cheapest
    breakdown: {
      gpu: gpuMonthly,
      storage: storageMonthly,
      networking: networkMonthly,
      controlPlane: controlPlaneMonthly,
      support: supportMonthly,
      goodput: goodputMonthly,
      setup: setupMonthly,
      debugging: debugMonthly,
    },
    breakdownPct: {
      gpu: 0, storage: 0, networking: 0, controlPlane: 0,
      support: 0, goodput: 0, setup: 0, debugging: 0,
    },
    goodputLossPct,
    reliability: {
      mtbf: mtbf,
      failureDetectMin: f.failureIdentifyMinutes,
      repairMin: f.repairReplaceMinutes,
      hotSpares: f.hotSpares,
      interconnect: f.interconnect,
    },
    notes: provider.notes,
  };
}

export default function TCOCalculator({ providers }: Props) {
  const [scenario, setScenario] = useState("custom");
  const [gpuModel, setGpuModel] = useState("nvidia-h200");
  const [gpuCount, setGpuCount] = useState(512);
  const [storageHotTb, setStorageHotTb] = useState(500);
  const [storageColdTb, setStorageColdTb] = useState(0);
  const [months, setMonths] = useState(36);
  const [jobSizeGpus, setJobSizeGpus] = useState(8);
  const [checkpointMin, setCheckpointMin] = useState(60);
  const [initMin, setInitMin] = useState(15);
  const [blastRadius, setBlastRadius] = useState(8);
  const [faultTolerant, setFaultTolerant] = useState(true);

  // Scenario presets
  const applyScenario = (id: string) => {
    setScenario(id);
    if (id === "llm-pretrain") {
      setGpuModel("nvidia-gb300"); setGpuCount(5184); setStorageHotTb(500); setStorageColdTb(10000);
      setMonths(36); setJobSizeGpus(4096); setCheckpointMin(30); setInitMin(10); setBlastRadius(64); setFaultTolerant(false);
    } else if (id === "rl-research") {
      setGpuModel("nvidia-b200"); setGpuCount(2048); setStorageHotTb(25000); setStorageColdTb(0);
      setMonths(36); setJobSizeGpus(64); setCheckpointMin(60); setInitMin(10); setBlastRadius(8); setFaultTolerant(false);
    } else if (id === "inference") {
      setGpuModel("nvidia-h200"); setGpuCount(512); setStorageHotTb(1000); setStorageColdTb(0);
      setMonths(36); setJobSizeGpus(8); setCheckpointMin(60); setInitMin(15); setBlastRadius(8); setFaultTolerant(true);
    }
  };

  const config = { gpuModel, gpuCount, months, storageHotTb, storageColdTb, jobSizeGpus, checkpointMin, initMin, blastRadius, faultTolerant };

  const results = useMemo(() => {
    const raw = providers
      .map((p: any) => computeTCO(p, config))
      .filter(Boolean) as NonNullable<ReturnType<typeof computeTCO>>[];

    raw.sort((a, b) => a.effectivePerGpuHr - b.effectivePerGpuHr);
    const cheapest = raw[0]?.effectivePerGpuHr || 1;
    for (const r of raw) {
      r.tcoMultiplier = r.effectivePerGpuHr / cheapest;
      const total = r.totalMonthly;
      for (const key of Object.keys(r.breakdownPct) as Array<keyof typeof r.breakdownPct>) {
        r.breakdownPct[key] = (r.breakdown[key] / total) * 100;
      }
    }
    return raw;
  }, [providers, config]);

  const cheapest = results[0];
  const mostExpensive = results[results.length - 1];

  // Chart: sticker vs effective
  const rateData = results.map((r) => ({
    name: r.provider,
    sticker: r.gpuPrice,
    effective: Math.round(r.effectivePerGpuHr * 100) / 100,
    tier: r.tier,
  }));

  // Chart: TCO breakdown
  const breakdownData = results.map((r) => ({
    name: r.provider,
    GPU: Math.round(r.breakdown.gpu / 1000),
    Storage: Math.round(r.breakdown.storage / 1000),
    Network: Math.round(r.breakdown.networking / 1000),
    "Ctrl Plane": Math.round(r.breakdown.controlPlane / 1000),
    Support: Math.round(r.breakdown.support / 1000),
    Goodput: Math.round(r.breakdown.goodput / 1000),
    Setup: Math.round(r.breakdown.setup / 1000),
    Debug: Math.round(r.breakdown.debugging / 1000),
  }));

  return (
    <div>
      {/* Scenario presets */}
      <Section title="Cluster TCO Calculator" subtitle="BEP Research 8-component TCO framework. Select a scenario preset or configure your own cluster.">
        <div className="flex gap-2 mb-4">
          {[
            { id: "llm-pretrain", label: "LLM Pretrain", sub: "5,184 GB300" },
            { id: "rl-research", label: "RL Research", sub: "2,048 B200" },
            { id: "inference", label: "Inference", sub: "512 H200" },
            { id: "custom", label: "Custom", sub: "" },
          ].map((s) => (
            <button key={s.id} onClick={() => applyScenario(s.id)}
              className="flex-1 px-3 py-2 rounded border font-mono text-xs transition-colors"
              style={{
                background: scenario === s.id ? "#76B90015" : "#0a0a0a",
                borderColor: scenario === s.id ? "#76B90060" : "#1a1a1a",
                color: scenario === s.id ? "#76B900" : "#999",
              }}>
              <div className="font-semibold">{s.label}</div>
              {s.sub && <div className="text-[10px] mt-0.5 opacity-70">{s.sub}</div>}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">GPU</label>
              <select value={gpuModel} onChange={(e) => { setGpuModel(e.target.value); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none">
                {["nvidia-h100","nvidia-h200","nvidia-b200","nvidia-b300","nvidia-gb200","nvidia-gb300"].map((g) => (
                  <option key={g} value={g}>{GPU_DISPLAY_NAMES[g] || g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">GPUs</label>
              <input type="number" value={gpuCount} onChange={(e) => { setGpuCount(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Hot Storage (TB)</label>
              <input type="number" value={storageHotTb} onChange={(e) => { setStorageHotTb(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Contract (mo)</label>
              <select value={months} onChange={(e) => { setMonths(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none">
                {[3, 6, 12, 24, 36].map((n) => <option key={n} value={n}>{n}mo</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Job Size (GPUs)</label>
              <input type="number" value={jobSizeGpus} onChange={(e) => { setJobSizeGpus(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Checkpoint (min)</label>
              <input type="number" value={checkpointMin} onChange={(e) => { setCheckpointMin(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Init Time (min)</label>
              <input type="number" value={initMin} onChange={(e) => { setInitMin(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Blast Radius</label>
              <select value={blastRadius} onChange={(e) => { setBlastRadius(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none">
                <option value={8}>8 (HGX server)</option>
                <option value={64}>64 (NVL72)</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Cold Storage (TB)</label>
              <input type="number" value={storageColdTb} onChange={(e) => { setStorageColdTb(Number(e.target.value)); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-bep-muted uppercase tracking-widest mb-1.5 font-mono">Fault Tolerant</label>
              <select value={faultTolerant ? "yes" : "no"} onChange={(e) => { setFaultTolerant(e.target.value === "yes"); setScenario("custom"); }}
                className="w-full bg-bep-bg border border-bep-border2 rounded px-2 py-1.5 text-xs text-bep-white font-mono focus:border-bep-green focus:outline-none">
                <option value="no">No (training)</option>
                <option value="yes">Yes (inference)</option>
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* Hero metrics */}
      {results.length > 0 && (
        <div className="grid grid-cols-5 gap-2.5 mb-5">
          <Metric label="Cheapest (effective)" value={`$${cheapest?.effectivePerGpuHr.toFixed(2)}/hr`} sub={cheapest?.provider} color="#76B900" />
          <Metric label="Most Expensive" value={`$${mostExpensive?.effectivePerGpuHr.toFixed(2)}/hr`} sub={`${mostExpensive?.provider} (${mostExpensive?.tcoMultiplier.toFixed(2)}x)`} color="#FF4444" />
          <Metric label="Monthly (cheapest)" value={`$${cheapest ? (cheapest.totalMonthly / 1e6).toFixed(2) : "?"}M`} sub={`${gpuCount}× ${GPU_DISPLAY_NAMES[gpuModel] || gpuModel}`} color="#00D4FF" />
          <Metric label={`${months}mo Contract`} value={`$${cheapest ? (cheapest.totalContract / 1e6).toFixed(1) : "?"}M`} sub={cheapest?.provider} color="#FFB800" />
          <Metric label="TCO / 1M Tokens" value={`$${cheapest?.tcoPerMillionTokens.toFixed(4)}`} sub={`${cheapest?.provider} — connects TCO to token economics`} color="#A855F7" />
        </div>
      )}

      {/* Sticker vs Effective */}
      {rateData.length > 0 && (
        <Section title="Sticker Price vs True Cost Per GPU-Hour" subtitle="Gray = advertised $/GPU-hr. Colored = effective rate after all 8 TCO components. The gap is the hidden premium.">
          <div className="bg-bep-card border border-bep-border rounded-md p-4">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={rateData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v.toFixed(1)}`} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                  formatter={(v, name) => [`$${Number(v).toFixed(2)}/GPU-hr`, name]} />
                <Bar dataKey="sticker" name="Sticker $/GPU-hr" fill="#444" barSize={16} radius={[2, 2, 0, 0]} />
                <Bar dataKey="effective" name="Effective $/GPU-hr" barSize={16} radius={[4, 4, 0, 0]}>
                  {rateData.map((d, i) => <Cell key={i} fill={TIER_COLORS[d.tier] || "#666"} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
            <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted justify-center">
              <span><span className="text-[#444]">■</span> Sticker</span>
              {Object.entries(TIER_COLORS).map(([tier, color]) => {
                if (results.some((r) => r.tier === tier)) {
                  return <span key={tier}><span style={{ color }}>■</span> {tier.replace(/-/g, " ")}</span>;
                }
                return null;
              })}
            </div>
          </div>
        </Section>
      )}

      {/* 8-component breakdown */}
      {breakdownData.length > 0 && (
        <Section title="8-Component TCO Breakdown ($K/month)" subtitle="BEP Research framework: GPU + Storage + Networking + Control Plane + Support + Goodput + Setup + Debugging.">
          <div className="bg-bep-card border border-bep-border rounded-md p-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={breakdownData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 10 }} />
                <YAxis tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v: number) => `$${v}K`} />
                <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11, fontFamily: "monospace" }}
                  formatter={(v) => [`$${Number(v).toLocaleString()}K`, ""]} />
                <Bar dataKey="GPU" stackId="a" fill="#555" name="GPU Rental" />
                <Bar dataKey="Storage" stackId="a" fill="#FF6B35" name="Storage" />
                <Bar dataKey="Network" stackId="a" fill="#A855F7" name="Networking" />
                <Bar dataKey="Ctrl Plane" stackId="a" fill="#3B82F6" name="Control Plane" />
                <Bar dataKey="Support" stackId="a" fill="#FF4444" name="Support" />
                <Bar dataKey="Goodput" stackId="a" fill="#76B900" name="Goodput Loss" />
                <Bar dataKey="Setup" stackId="a" fill="#00D4FF" name="Setup/POC" />
                <Bar dataKey="Debug" stackId="a" fill="#EC4899" name="Debugging" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap gap-3 mt-2 text-[10px] font-mono text-bep-muted justify-center">
              <span><span className="text-[#555]">■</span> GPU</span>
              <span><span className="text-[#FF6B35]">■</span> Storage</span>
              <span><span className="text-bep-purple">■</span> Network</span>
              <span><span className="text-[#3B82F6]">■</span> Ctrl Plane</span>
              <span><span className="text-bep-red">■</span> Support</span>
              <span><span className="text-bep-green">■</span> Goodput</span>
              <span><span className="text-bep-cyan">■</span> Setup</span>
              <span><span className="text-bep-pink">■</span> Debug</span>
            </div>
          </div>
        </Section>
      )}

      {/* Provider table */}
      <Section title="Provider Detail" subtitle="Sorted by effective TCO. Includes reliability metrics, interconnect quality, and BEP tier rating.">
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={r.providerId} className="bg-bep-card border border-bep-border rounded-md p-3.5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-bep-white">{r.provider}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{
                    background: (TIER_COLORS[r.tier] || "#666") + "15",
                    color: TIER_COLORS[r.tier] || "#666",
                    border: `1px solid ${(TIER_COLORS[r.tier] || "#666")}40`,
                  }}>
                    {r.bepTier ? `BEP ${r.bepTier}` : r.tier.replace(/-/g, " ")}
                  </span>
                  {i === 0 && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#76B90015] border border-[#76B90040] text-bep-green">Cheapest TCO</span>}
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold font-mono" style={{ color: i === 0 ? "#76B900" : i === results.length - 1 ? "#FF4444" : "#f0f0f0" }}>
                    {r.tcoMultiplier.toFixed(2)}x
                  </span>
                  <span className="text-[10px] text-bep-muted ml-1">vs cheapest</span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3 mb-2">
                <div>
                  <div className="text-[10px] text-bep-muted font-mono uppercase">Sticker</div>
                  <div className="text-sm font-mono text-bep-dim">${r.gpuPrice}/GPU-hr</div>
                </div>
                <div>
                  <div className="text-[10px] text-bep-muted font-mono uppercase">Effective</div>
                  <div className="text-sm font-mono text-bep-white font-semibold">${r.effectivePerGpuHr.toFixed(2)}/GPU-hr</div>
                </div>
                <div>
                  <div className="text-[10px] text-bep-muted font-mono uppercase">Monthly</div>
                  <div className="text-sm font-mono text-bep-amber">${(r.totalMonthly / 1e6).toFixed(2)}M</div>
                </div>
                <div>
                  <div className="text-[10px] text-bep-muted font-mono uppercase">Goodput Loss</div>
                  <div className="text-sm font-mono" style={{ color: r.goodputLossPct < 1 ? "#76B900" : r.goodputLossPct < 5 ? "#FFB800" : "#FF4444" }}>
                    {r.goodputLossPct.toFixed(3)}%
                  </div>
                </div>
              </div>

              {/* Reliability row */}
              <div className="flex gap-4 text-[10px] font-mono text-bep-dim border-t border-bep-border pt-2">
                <span>MTBF: {(r.reliability.mtbf / 1000).toFixed(0)}K GPU-hr</span>
                <span>Detect: {r.reliability.failureDetectMin}min</span>
                <span>Repair: {r.reliability.repairMin}min</span>
                <span style={{ color: r.reliability.hotSpares ? "#76B900" : "#FF4444" }}>
                  Hot spares: {r.reliability.hotSpares ? "Yes" : "No"}
                </span>
                <span>{r.reliability.interconnect}</span>
              </div>

              {/* % breakdown bar */}
              <div className="flex h-2 rounded-full overflow-hidden mt-2">
                {[
                  { key: "gpu", color: "#555" },
                  { key: "storage", color: "#FF6B35" },
                  { key: "networking", color: "#A855F7" },
                  { key: "controlPlane", color: "#3B82F6" },
                  { key: "support", color: "#FF4444" },
                  { key: "goodput", color: "#76B900" },
                  { key: "setup", color: "#00D4FF" },
                  { key: "debugging", color: "#EC4899" },
                ].map(({ key, color }) => {
                  const pct = r.breakdownPct[key as keyof typeof r.breakdownPct];
                  if (pct < 0.3) return null;
                  return <div key={key} style={{ width: `${pct}%`, background: color }} />;
                })}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <InsightBox>
        BEP Research analysis shows hyperscalers can be 9-113% more expensive than gold-tier neoclouds on full TCO. The worst case (inference endpoints) is driven by storage, support (10% tax), networking charges, and setup costs that don&apos;t exist on gold-tier neoclouds. Silver-tier neoclouds are 4-8% more expensive due to 4x slower failure detection and no hot spares. The &quot;cheapest GPU-hour&quot; is a decoy metric — negotiate on TCO and goodput, not list price. Sources: provider pricing pages, earnings calls, IPO filings.
      </InsightBox>
    </div>
  );
}
