"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Section from "./ui/Section";
import Metric from "./ui/Metric";
import InsightBox from "./ui/InsightBox";

export interface GPUHardwareSpec {
  id: string;
  name: string;
  vendor: "nvidia" | "amd";
  memoryGB: number;
  memoryType: string;
  memoryBandwidthTBs: number;
  fp4TFLOPS: number | null;
  fp8TFLOPS: number;
  bf16TFLOPS: number;
  scaleUpTech: string;
  scaleUpBandwidthGBs: number;
  scaleUpDomain: number;
  scaleOutBandwidthGBs: number | null;
}

export interface GPUHardwareSpecsData {
  source: string;
  lastUpdated: string;
  gpus: GPUHardwareSpec[];
}

interface Props {
  data: GPUHardwareSpecsData;
}

const VENDOR_COLOR: Record<string, string> = {
  nvidia: "#76B900",
  amd: "#ED1C24",
};

export default function HardwareSpecs({ data }: Props) {
  const { gpus, source } = data;

  // Top-line metrics
  const maxFP8 = gpus.reduce((m, g) => (g.fp8TFLOPS > m.fp8TFLOPS ? g : m), gpus[0]);
  const maxMem = gpus.reduce((m, g) => (g.memoryGB > m.memoryGB ? g : m), gpus[0]);
  const maxBW = gpus.reduce((m, g) => (g.memoryBandwidthTBs > m.memoryBandwidthTBs ? g : m), gpus[0]);
  const maxDomain = gpus.reduce((m, g) => (g.scaleUpDomain > m.scaleUpDomain ? g : m), gpus[0]);

  // FP8 TFLOPS chart data
  const fp8Data = gpus.map((g) => ({
    name: g.name,
    value: g.fp8TFLOPS,
    vendor: g.vendor,
  }));

  // Memory bandwidth chart data
  const bwData = gpus.map((g) => ({
    name: g.name,
    value: g.memoryBandwidthTBs * 1000, // convert to GB/s for readability
    vendor: g.vendor,
  }));

  // Scale-up domain data
  const domainData = gpus.map((g) => ({
    name: g.name,
    vendor: g.vendor,
    perGpuMemGB: g.memoryGB,
    totalMemTB: (g.memoryGB * g.scaleUpDomain) / 1000,
    perGpuBwTBs: g.memoryBandwidthTBs,
    totalBwTBs: g.memoryBandwidthTBs * g.scaleUpDomain,
    worldSize: g.scaleUpDomain,
    scaleUpTech: g.scaleUpTech,
    scaleUpBwGBs: g.scaleUpBandwidthGBs,
  }));

  return (
    <div>
      {/* Hero metrics */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Metric label="Peak FP8 TFLOPS" value={`${maxFP8.fp8TFLOPS.toLocaleString()}`} sub={maxFP8.name} color="#00D4FF" />
        <Metric label="Max VRAM / GPU" value={`${maxMem.memoryGB} GB`} sub={maxMem.name} color="#76B900" />
        <Metric label="Peak Mem BW" value={`${maxBW.memoryBandwidthTBs} TB/s`} sub={maxBW.name} color="#FFB800" />
        <Metric label="Largest Domain" value={`${maxDomain.scaleUpDomain}-GPU`} sub={`${((maxDomain.memoryGB * maxDomain.scaleUpDomain) / 1000).toFixed(1)} TB total`} color="#ED1C24" />
      </div>

      {/* Comparison Table */}
      <Section title="GPU Hardware Comparison" subtitle={`Spec data from ${source}. Updated ${data.lastUpdated}.`}>
        <div className="bg-bep-card border border-bep-border rounded-md overflow-x-auto">
          <table className="w-full text-xs font-mono" style={{ minWidth: 800 }}>
            <thead>
              <tr className="text-[10px] text-bep-muted uppercase tracking-wider border-b border-bep-border">
                <th className="text-left px-3 py-2.5">GPU</th>
                <th className="text-right px-2 py-2.5">VRAM</th>
                <th className="text-right px-2 py-2.5">Mem Type</th>
                <th className="text-right px-2 py-2.5">BW (TB/s)</th>
                <th className="text-right px-2 py-2.5">FP4</th>
                <th className="text-right px-2 py-2.5">FP8</th>
                <th className="text-right px-2 py-2.5">BF16</th>
                <th className="text-right px-2 py-2.5">Scale-Up</th>
                <th className="text-right px-2 py-2.5">Domain</th>
              </tr>
            </thead>
            <tbody>
              {gpus.map((gpu, i) => (
                <tr
                  key={gpu.id}
                  className="border-b border-bep-border last:border-0"
                  style={{ background: i % 2 === 0 ? "transparent" : "#0d0d0d" }}
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: VENDOR_COLOR[gpu.vendor] }}>
                    {gpu.name}
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-white">{gpu.memoryGB} GB</td>
                  <td className="text-right px-2 py-2.5 text-bep-dim">{gpu.memoryType}</td>
                  <td className="text-right px-2 py-2.5 text-bep-cyan">{gpu.memoryBandwidthTBs}</td>
                  <td className="text-right px-2 py-2.5 text-bep-dim">
                    {gpu.fp4TFLOPS ? gpu.fp4TFLOPS.toLocaleString() : "\u2014"}
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-white font-semibold">
                    {gpu.fp8TFLOPS.toLocaleString()}
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-dim">{gpu.bf16TFLOPS.toLocaleString()}</td>
                  <td className="text-right px-2 py-2.5 text-bep-dim text-[10px]">
                    {gpu.scaleUpTech} {gpu.scaleUpBandwidthGBs} GB/s
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-white">{gpu.scaleUpDomain}-GPU</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* FP8 TFLOPS Bar Chart */}
      <Section title="FP8 Compute (TFLOPS)" subtitle="FP8 is the dominant precision for LLM inference. Higher = more tokens/sec per GPU.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={fp8Data} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} width={75} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }}
                formatter={(value: unknown) => [`${Number(value).toLocaleString()} TFLOPS`, "FP8"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {fp8Data.map((entry, index) => (
                  <Cell key={`fp8-${index}`} fill={VENDOR_COLOR[entry.vendor]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted">
            <span><span style={{ color: "#76B900" }}>&#9632;</span> NVIDIA</span>
            <span><span style={{ color: "#ED1C24" }}>&#9632;</span> AMD</span>
          </div>
        </div>
      </Section>

      {/* Memory Bandwidth Bar Chart */}
      <Section title="Memory Bandwidth (GB/s)" subtitle="Memory bandwidth determines how fast model weights can be read during inference. The bottleneck for large-model serving.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={bwData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" horizontal={false} />
              <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} tickFormatter={(v) => `${v.toLocaleString()}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} width={75} />
              <Tooltip
                contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }}
                formatter={(value: unknown) => [`${Number(value).toLocaleString()} GB/s`, "Bandwidth"]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {bwData.map((entry, index) => (
                  <Cell key={`bw-${index}`} fill={VENDOR_COLOR[entry.vendor]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted">
            <span><span style={{ color: "#76B900" }}>&#9632;</span> NVIDIA</span>
            <span><span style={{ color: "#ED1C24" }}>&#9632;</span> AMD</span>
          </div>
        </div>
      </Section>

      {/* Scale-Up Domain */}
      <Section title="Scale-Up Domain: Total Capacity" subtitle="What happens when you multiply per-GPU specs by the full interconnect domain. This is the actual capacity available for a single inference job or training run.">
        <div className="bg-bep-card border border-bep-border rounded-md overflow-x-auto">
          <table className="w-full text-xs font-mono" style={{ minWidth: 700 }}>
            <thead>
              <tr className="text-[10px] text-bep-muted uppercase tracking-wider border-b border-bep-border">
                <th className="text-left px-3 py-2.5">GPU</th>
                <th className="text-right px-2 py-2.5">World Size</th>
                <th className="text-right px-2 py-2.5">Per-GPU Mem</th>
                <th className="text-right px-2 py-2.5">Total Memory</th>
                <th className="text-right px-2 py-2.5">Per-GPU BW</th>
                <th className="text-right px-2 py-2.5">Total BW</th>
                <th className="text-right px-2 py-2.5">Interconnect</th>
              </tr>
            </thead>
            <tbody>
              {domainData.map((d, i) => (
                <tr
                  key={d.name}
                  className="border-b border-bep-border last:border-0"
                  style={{ background: i % 2 === 0 ? "transparent" : "#0d0d0d" }}
                >
                  <td className="px-3 py-2.5 font-medium" style={{ color: VENDOR_COLOR[d.vendor] }}>
                    {d.name}
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-white font-semibold">{d.worldSize}</td>
                  <td className="text-right px-2 py-2.5 text-bep-dim">{d.perGpuMemGB} GB</td>
                  <td className="text-right px-2 py-2.5 text-bep-cyan font-semibold">
                    {d.totalMemTB >= 1 ? `${d.totalMemTB.toFixed(1)} TB` : `${(d.totalMemTB * 1000).toFixed(0)} GB`}
                  </td>
                  <td className="text-right px-2 py-2.5 text-bep-dim">{d.perGpuBwTBs} TB/s</td>
                  <td className="text-right px-2 py-2.5 text-bep-green font-semibold">{d.totalBwTBs.toFixed(1)} TB/s</td>
                  <td className="text-right px-2 py-2.5 text-bep-dim text-[10px]">
                    {d.scaleUpTech} {d.scaleUpBwGBs} GB/s
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <InsightBox>
        The GB300 NVL72 rack is the new unit of AI infrastructure: 288 GB x 72 GPUs = 20.7 TB of coherent memory at 576 TB/s aggregate bandwidth. That single rack can serve a 1T+ parameter model without tensor parallelism across racks. Compare to the H100 era where 8-GPU nodes capped at 640 GB total. The NVL72 interconnect domain is the architectural moat: AMD&apos;s 8-GPU Infinity Fabric domain means they need multiple racks (and slower scale-out networking) to match what NVIDIA does in one.
      </InsightBox>
    </div>
  );
}
