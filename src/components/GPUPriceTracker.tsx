"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";
import GPUAvailabilityChart from "./GPUAvailabilityChart";
import { GPU_DISPLAY_NAMES } from "@/lib/calculations";
import type { GPUSummary } from "@/lib/data";

interface Props {
  summaries: GPUSummary[];
  source: string;
  fetchedAt: string;
  history: Record<string, GPUSummary[]>;
}

export default function GPUPriceTracker({ summaries, source, fetchedAt, history }: Props) {
  const totalAvailable = summaries.reduce((s, g) => s + g.totalGpusAvailable, 0);
  const totalRented = summaries.reduce((s, g) => s + g.totalGpusRented, 0);
  const totalGpus = totalAvailable + totalRented;
  const overallAvailPct = totalGpus > 0 ? Math.round((totalAvailable / totalGpus) * 100) : 0;

  // Price vs Availability correlation data
  const correlationData = summaries.map((gpu) => ({
    name: GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel,
    price: gpu.spot.median || gpu.onDemand.median || 0,
    availability: gpu.availabilityPct,
    supply: gpu.totalGpusAvailable + gpu.totalGpusRented,
    color: gpu.availabilityPct >= 70 ? "#76B900" : gpu.availabilityPct >= 30 ? "#FFB800" : "#FF4444",
  }));

  // Availability bar chart data
  const availData = summaries.map((gpu) => ({
    name: GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel,
    available: gpu.totalGpusAvailable,
    rented: gpu.totalGpusRented,
    pct: gpu.availabilityPct,
  }));

  return (
    <div>
      {/* Hero metrics */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <Metric label="Total GPUs Tracked" value={`${totalGpus}`} sub={`${summaries.length} models`} color="#00D4FF" />
        <Metric label="Available Now" value={`${totalAvailable}`} sub={`${overallAvailPct}% of supply`} color="#76B900" />
        <Metric label="Currently Rented" value={`${totalRented}`} sub={`${100 - overallAvailPct}% utilization`} color="#FF4444" />
        <Metric
          label="Cheapest Spot"
          value={(() => {
            const allSpot = summaries.filter(g => g.spot.min !== null).map(g => ({ model: g.gpuModel, price: g.spot.min! }));
            const cheapest = allSpot.sort((a, b) => a.price - b.price)[0];
            return cheapest ? `$${cheapest.price.toFixed(2)}/hr` : "N/A";
          })()}
          sub={(() => {
            const allSpot = summaries.filter(g => g.spot.min !== null).map(g => ({ model: g.gpuModel, price: g.spot.min! }));
            const cheapest = allSpot.sort((a, b) => a.price - b.price)[0];
            return cheapest ? GPU_DISPLAY_NAMES[cheapest.model] || cheapest.model : "";
          })()}
          color="#FFB800"
        />
      </div>

      {/* Main pricing table */}
      <Section title="GPU Cloud Pricing Tracker" subtitle={`Live spot market data from ${source}. Updated ${new Date(fetchedAt).toLocaleDateString()}.`}>
        <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
          <div className="grid font-mono text-[10px] text-bep-muted uppercase tracking-wider px-3.5 py-2.5 border-b border-bep-border"
            style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr" }}>
            <span>GPU</span>
            <span className="text-right">Spot Med $/hr</span>
            <span className="text-right">Spot Min</span>
            <span className="text-right">Spot Max</span>
            <span className="text-right">Avail %</span>
            <span className="text-right">GPUs Free</span>
            <span className="text-right">Reliability</span>
          </div>
          {summaries.map((gpu, i) => (
            <div key={gpu.gpuModel} className="grid px-3.5 py-2.5 text-xs border-b border-bep-border last:border-0"
              style={{
                gridTemplateColumns: "1.2fr 1fr 1fr 1fr 0.8fr 0.8fr 0.8fr",
                background: i % 2 === 0 ? "transparent" : "#0d0d0d"
              }}>
              <span className="text-bep-white font-medium font-mono">{GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel}</span>
              <span className="text-right font-mono text-bep-cyan">
                {gpu.spot.median ? `$${gpu.spot.median.toFixed(2)}` : gpu.onDemand.median ? `$${gpu.onDemand.median.toFixed(2)}` : "N/A"}
              </span>
              <span className="text-right font-mono text-bep-green">
                {gpu.spot.min ? `$${gpu.spot.min.toFixed(2)}` : "N/A"}
              </span>
              <span className="text-right font-mono text-bep-dim">
                {gpu.spot.max ? `$${gpu.spot.max.toFixed(2)}` : "N/A"}
              </span>
              <span className="text-right font-mono font-semibold" style={{
                color: gpu.availabilityPct >= 70 ? "#76B900" : gpu.availabilityPct >= 30 ? "#FFB800" : "#FF4444"
              }}>
                {gpu.availabilityPct}%
              </span>
              <span className="text-right font-mono text-bep-dim">
                {gpu.totalGpusAvailable}/{gpu.totalGpusAvailable + gpu.totalGpusRented}
              </span>
              <span className="text-right font-mono" style={{
                color: gpu.avgReliability >= 95 ? "#76B900" : gpu.avgReliability >= 80 ? "#FFB800" : "#FF4444"
              }}>
                {gpu.avgReliability > 0 ? `${gpu.avgReliability.toFixed(0)}%` : "—"}
              </span>
            </div>
          ))}
        </div>
      </Section>

      {/* Supply depth — available vs rented */}
      <Section title="GPU Supply Depth" subtitle="Available vs rented GPUs by model. Low availability + high rental = supply constraint signal.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={availData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="name" tick={{ fill: "#f0f0f0", fontSize: 11 }} />
              <YAxis tick={{ fill: "#666", fontSize: 10 }} />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }} />
              <Bar dataKey="available" stackId="a" fill="#76B900" name="Available" radius={[0, 0, 0, 0]} />
              <Bar dataKey="rented" stackId="a" fill="#FF4444" name="Rented" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Price vs Availability correlation */}
      <Section title="Price vs Availability Correlation" subtitle="Do scarcer GPUs cost more? This chart maps spot price against availability percentage. The thesis: as token demand grows (Jevons), supply tightens, prices should rise for newer GPUs — but commoditized GPUs deflate.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          {correlationData.length > 0 ? (
            <div className="space-y-3">
              {correlationData.map((d) => (
                <div key={d.name} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-bep-white min-w-[60px]">{d.name}</span>
                  <div className="flex-1 flex items-center gap-2">
                    {/* Price bar */}
                    <div className="flex-1 bg-bep-bg rounded-sm overflow-hidden h-5 relative">
                      <div
                        className="h-full rounded-sm flex items-center justify-end pr-2"
                        style={{
                          width: `${Math.min((d.price / Math.max(...correlationData.map(c => c.price))) * 100, 100)}%`,
                          background: "#00D4FF30",
                          borderRight: "2px solid #00D4FF",
                        }}
                      >
                        <span className="text-[10px] font-mono text-bep-cyan">${d.price.toFixed(2)}/hr</span>
                      </div>
                    </div>
                    {/* Availability bar */}
                    <div className="w-24 bg-bep-bg rounded-sm overflow-hidden h-5 relative">
                      <div
                        className="h-full rounded-sm flex items-center justify-center"
                        style={{
                          width: `${d.availability}%`,
                          background: d.availability >= 70 ? "#76B90030" : d.availability >= 30 ? "#FFB80030" : "#FF444430",
                          borderRight: `2px solid ${d.color}`,
                        }}
                      >
                        <span className="text-[10px] font-mono" style={{ color: d.color }}>{d.availability}%</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-[10px] text-bep-muted font-mono min-w-[40px] text-right">{d.supply} GPUs</span>
                </div>
              ))}
              <div className="flex gap-4 mt-2 text-[10px] font-mono text-bep-muted">
                <span><span className="text-bep-cyan">■</span> Spot Price</span>
                <span><span className="text-bep-green">■</span> Availability</span>
              </div>
            </div>
          ) : (
            <div className="text-center text-bep-muted text-sm py-8">No GPU data available</div>
          )}
        </div>
      </Section>

      {/* Region distribution */}
      {summaries.some(g => Object.keys(g.regions).length > 0) && (
        <Section title="Geographic Distribution" subtitle="Where GPU supply is concentrated. Regional concentration = single-point-of-failure risk for inference providers.">
          <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
            {summaries.filter(g => Object.keys(g.regions).length > 0).map((gpu, i) => (
              <div key={gpu.gpuModel} className="p-3 border-b border-bep-border last:border-0" style={{ background: i % 2 === 0 ? "transparent" : "#0d0d0d" }}>
                <div className="text-xs font-mono font-semibold text-bep-white mb-1.5">{GPU_DISPLAY_NAMES[gpu.gpuModel] || gpu.gpuModel}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(gpu.regions).sort((a, b) => b[1] - a[1]).map(([region, count]) => (
                    <span key={region} className="text-[10px] font-mono px-2 py-0.5 rounded bg-bep-bg border border-bep-border text-bep-dim">
                      {region} <span className="text-bep-cyan">{count}</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Historical charts — 3Fourteen style */}
      <GPUAvailabilityChart history={history} mode="availability" />
      <GPUAvailabilityChart history={history} mode="price" />

      <InsightBox>
        GPU availability is the physical manifestation of token demand. When availability drops below 30%, spot prices spike — that&apos;s the supply constraint translating into token cost. Track B200 availability specifically: as Blackwell deployment ramps, B200 spot pricing will deflate toward H100 levels. That crossover date is the signal that next-gen inference economics have arrived.
      </InsightBox>
    </div>
  );
}
