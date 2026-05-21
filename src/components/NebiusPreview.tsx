"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { formatPrice } from "@/lib/calculations";

export interface HeadToHead {
  modelId: string;
  display: string;
  nebiusIn: number;
  nebiusOut: number;
  marketIn: number;
  marketOut: number;
  deltaPct: number;
}

export interface CatalogEntry {
  model: string;
  modelId: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
  contextWindow: number;
}

export interface PlatformAddressability {
  id: string;
  name: string;
  vendor: string;
  category: string;
  tier: string;
  openShare: number;
  closedShare: number;
  proprietaryShare: number;
  matchedModels: string[];
}

export interface NebiusPreviewProps {
  generatedAt: string;
  catalog: CatalogEntry[];
  headToHead: HeadToHead[];
  floor: { display: string; modelId: string; outputPerMillion: number } | null;
  avgDiscountPct: number;
  catalogSize: number;
  marketComparableCount: number;
  platforms: PlatformAddressability[];
  trajectory: Array<{ date: string; floor: number }>;
}

const NEB_GREEN = "#76B900";
const MKT_GREY = "#666666";

type TabId = "marketing" | "pricing" | "gtm";

const TABS: Array<{ id: TabId; label: string; sub: string }> = [
  { id: "marketing", label: "01 · Marketing", sub: "the keynote stat" },
  { id: "pricing", label: "02 · Pricing", sub: "head-to-head reference" },
  { id: "gtm", label: "03 · GTM", sub: "platform addressability" },
];

export default function NebiusPreview(props: NebiusPreviewProps) {
  const [tab, setTab] = useState<TabId>("marketing");
  const dateStr = new Date(props.generatedAt).toUTCString().slice(5, 16).trim();

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      <ConfidentialBand dateStr={dateStr} />

      <div className="px-6 pt-5 pb-4 max-w-[960px] mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-serif text-[28px] font-bold text-bep-white leading-tight">
            Cost-per-token, the Nebius cut
          </div>
          <div className="text-[10px] font-mono text-bep-dim hidden sm:block">
            BEP Research · Ben Pouladian
          </div>
        </div>
        <div className="text-[12px] text-bep-dim leading-relaxed max-w-[680px]">
          A pre-read for the Nebius team ahead of June 9, San Francisco. Three views on the
          same dataset: the keynote-ready stat for marketing, the head-to-head pricing reference,
          and the platform shortlist for GTM. Numbers below are computed from live Nebius
          Token Factory pricing and the BEP Research market panel.
        </div>

        <div className="mt-5 flex gap-0 border-b border-bep-border">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2.5 text-left transition-colors"
                style={{
                  background: "transparent",
                  borderBottom: active ? `2px solid ${NEB_GREEN}` : "2px solid transparent",
                  marginBottom: -1,
                }}
              >
                <div
                  className="text-[12px] font-mono"
                  style={{ color: active ? "#f0f0f0" : "#777", fontWeight: active ? 700 : 500 }}
                >
                  {t.label}
                </div>
                <div className="text-[10px] text-bep-dim">{t.sub}</div>
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {tab === "marketing" && <MarketingTab {...props} />}
          {tab === "pricing" && <PricingTab {...props} />}
          {tab === "gtm" && <GTMTab {...props} />}
        </div>

        <FooterCTA />
      </div>
    </div>
  );
}

function ConfidentialBand({ dateStr }: { dateStr: string }) {
  return (
    <div
      className="w-full px-6 py-1.5 text-center text-[10px] font-mono tracking-[0.18em] uppercase"
      style={{
        background: "#1a1100",
        color: "#FFB800",
        borderBottom: "1px solid #2a1d00",
      }}
    >
      Preview for Nebius · Confidential · Not for distribution · Snapshot {dateStr}
    </div>
  );
}

function MarketingTab(p: NebiusPreviewProps) {
  const discount = Math.max(0, p.avgDiscountPct);
  const headlineModels = p.headToHead.slice(0, 8);

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <BigMetric
          value={p.catalogSize.toString()}
          label="Open models live"
          sub="Nebius Token Factory"
        />
        <BigMetric
          value={p.floor ? `$${p.floor.outputPerMillion.toFixed(2)}` : "—"}
          label="Output floor / M tok"
          sub={p.floor?.display.slice(0, 30) || ""}
        />
        <BigMetric
          value={`${discount.toFixed(0)}%`}
          label="Avg vs. market"
          sub={`across ${p.marketComparableCount} verifiable models`}
          color="#00D4FF"
        />
        <BigMetric
          value={p.platforms.length.toString()}
          label="Tracked platforms"
          sub="with Nebius-addressable open share"
          color="#A855F7"
        />
      </div>

      <div className="bg-bep-card border border-bep-border rounded-md p-4 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-bep-muted mb-2">
          The line for a keynote
        </div>
        <div className="font-serif text-[18px] leading-snug text-bep-white">
          {p.floor && p.marketComparableCount > 0 ? (
            <>
              Nebius serves <span style={{ color: NEB_GREEN }}>{p.catalogSize} open models</span>{" "}
              from a floor of <span style={{ color: NEB_GREEN }}>${p.floor.outputPerMillion.toFixed(2)}/M output tokens</span>.
              Across the {p.marketComparableCount} open models where we can compare directly to the broader inference market,
              Nebius lands an average of <span style={{ color: NEB_GREEN }}>{discount.toFixed(0)}% below</span> the market output rate.
            </>
          ) : (
            <>Catalog and market-comparison metrics will populate once the next pricing snapshot lands.</>
          )}
        </div>
      </div>

      <SectionHeader
        title="Head-to-head, open models"
        sub="Each pair = same model, same day. Nebius Token Factory vs. broader inference market (OpenRouter aggregate)."
      />
      <div className="bg-bep-card border border-bep-border rounded-md p-3">
        <div style={{ width: "100%", height: Math.max(180, headlineModels.length * 38) }}>
          <ResponsiveContainer>
            <BarChart
              data={headlineModels.map((h) => ({
                name: shorten(h.display, 22),
                Nebius: round(h.nebiusOut, 3),
                Market: round(h.marketOut, 3),
              }))}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                type="number"
                stroke="#666"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `$${v}`}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#666"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                width={150}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0a",
                  border: "1px solid #252525",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                formatter={(value) => `$${Number(value)}/M`}
              />
              <Bar dataKey="Market" fill={MKT_GREY} radius={[0, 2, 2, 0]} />
              <Bar dataKey="Nebius" fill={NEB_GREEN} radius={[0, 2, 2, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] font-mono text-bep-dim mt-2">
          $/M output tokens · lower is cheaper · grey = market median, green = Nebius
        </div>
      </div>

      {p.trajectory.length > 1 && (
        <>
          <div className="mt-6" />
          <SectionHeader
            title="Nebius output floor — daily trajectory"
            sub="The lowest $/M output rate Nebius has offered, per day, across the catalog we observe."
          />
          <div className="bg-bep-card border border-bep-border rounded-md p-3">
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer>
                <LineChart data={p.trajectory.map((t) => ({ date: t.date.slice(5), floor: round(t.floor, 3) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
                  <XAxis dataKey="date" stroke="#666" tick={{ fontSize: 10, fontFamily: "monospace" }} />
                  <YAxis stroke="#666" tick={{ fontSize: 10, fontFamily: "monospace" }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    contentStyle={{
                      background: "#0a0a0a",
                      border: "1px solid #252525",
                      borderRadius: 4,
                      fontSize: 11,
                      fontFamily: "monospace",
                    }}
                    formatter={(value) => `$${Number(value)}/M`}
                  />
                  <Line type="monotone" dataKey="floor" stroke={NEB_GREEN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <Insight>
        For a marketing/AR conversation, the strongest single number is the floor — &quot;from
        ${p.floor ? p.floor.outputPerMillion.toFixed(2) : "—"}/M&quot; — paired with the {discount.toFixed(0)}% market-delta. SemiAnalysis
        tracks silicon and capex; this is the demand-side equivalent.
      </Insight>
    </div>
  );
}

function PricingTab(p: NebiusPreviewProps) {
  const h2hSet = new Set(p.headToHead.map((h) => h.modelId));
  const h2hByModel = new Map(p.headToHead.map((h) => [h.modelId, h]));

  return (
    <div>
      <SectionHeader
        title="Nebius Token Factory · full catalog"
        sub={`${p.catalog.length} generative models, ordered by output rate ascending. Rows highlighted green where a head-to-head market comparison is available.`}
      />
      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
          <div className="col-span-5">Model</div>
          <div className="col-span-2">Creator</div>
          <div className="col-span-2 text-right">$/M in</div>
          <div className="col-span-2 text-right">$/M out</div>
          <div className="col-span-1 text-right">vs. mkt</div>
        </div>
        {p.catalog.map((m) => {
          const h2h = h2hByModel.get(m.modelId);
          const verified = h2hSet.has(m.modelId);
          return (
            <div
              key={m.modelId}
              className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
              style={{ background: verified ? "rgba(118,185,0,0.05)" : "transparent" }}
            >
              <div className="col-span-5 text-bep-white truncate" title={m.modelId}>
                {m.model}
              </div>
              <div className="col-span-2 text-bep-dim">{m.provider}</div>
              <div className="col-span-2 text-right text-bep-text">{formatPrice(m.inputPerMillion)}</div>
              <div className="col-span-2 text-right text-bep-text">{formatPrice(m.outputPerMillion)}</div>
              <div className="col-span-1 text-right" style={{ color: h2h ? (h2h.deltaPct >= 0 ? NEB_GREEN : "#FF4444") : "#444" }}>
                {h2h ? `${h2h.deltaPct >= 0 ? "−" : "+"}${Math.abs(h2h.deltaPct).toFixed(0)}%` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      <Insight>
        &quot;vs. mkt&quot; is the spread on output rate vs. the OpenRouter aggregate price for the same model
        weights — a conservative comparison since OpenRouter routes to the cheapest serving provider it can find.
        Where the comparison is shown, the underlying methodology and source list are available under commercial terms.
      </Insight>
    </div>
  );
}

function GTMTab(p: NebiusPreviewProps) {
  const top = p.platforms.slice(0, 12);
  return (
    <div>
      <SectionHeader
        title="Platform shortlist · Nebius-addressable open share"
        sub="For each BEP-tracked enterprise/agent platform, the % of disclosed model mix (by weight) that is open-weights served on Nebius today. High open-share = warmest 'move to Nebius' conversation."
      />
      <div className="bg-bep-card border border-bep-border rounded-md p-3 mb-4">
        <div style={{ width: "100%", height: Math.max(220, top.length * 32) }}>
          <ResponsiveContainer>
            <BarChart
              data={top.map((pl) => ({
                name: pl.name,
                "Open / Nebius-addressable": round(pl.openShare * 100, 1),
                "Closed (OpenAI/Anthropic/Google)": round(pl.closedShare * 100, 1),
                Proprietary: round(pl.proprietaryShare * 100, 1),
              }))}
              layout="vertical"
              margin={{ top: 5, right: 25, left: 0, bottom: 5 }}
              stackOffset="expand"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis
                type="number"
                stroke="#666"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                tickFormatter={(v) => `${v}%`}
              />
              <YAxis
                dataKey="name"
                type="category"
                stroke="#666"
                tick={{ fontSize: 10, fontFamily: "monospace" }}
                width={130}
              />
              <Tooltip
                contentStyle={{
                  background: "#0a0a0a",
                  border: "1px solid #252525",
                  borderRadius: 4,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
                formatter={(value) => `${Number(value)}%`}
              />
              <ReferenceLine x={50} stroke="#252525" strokeDasharray="2 2" />
              <Bar dataKey="Open / Nebius-addressable" stackId="mix" fill={NEB_GREEN} />
              <Bar dataKey="Closed (OpenAI/Anthropic/Google)" stackId="mix" fill="#444" />
              <Bar dataKey="Proprietary" stackId="mix" fill="#A855F7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] font-mono text-bep-dim mt-2">
          Stacked share of each platform&apos;s model mix · green = open weights Nebius hosts today
        </div>
      </div>

      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
          <div className="col-span-3">Platform</div>
          <div className="col-span-2">Vendor</div>
          <div className="col-span-2">Tier</div>
          <div className="col-span-2 text-right">Open share</div>
          <div className="col-span-3">Nebius-served models</div>
        </div>
        {top.map((pl) => (
          <div key={pl.id} className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border">
            <div className="col-span-3 text-bep-white">{pl.name}</div>
            <div className="col-span-2 text-bep-dim">{pl.vendor}</div>
            <div className="col-span-2 text-bep-dim">{pl.tier}</div>
            <div className="col-span-2 text-right" style={{ color: NEB_GREEN }}>
              {(pl.openShare * 100).toFixed(0)}%
            </div>
            <div className="col-span-3 text-bep-text truncate" title={pl.matchedModels.join(", ")}>
              {pl.matchedModels.length > 0 ? pl.matchedModels.slice(0, 2).join(", ") : "—"}
            </div>
          </div>
        ))}
      </div>

      <Insight>
        The platforms above already serve at least one model Nebius hosts. The honest GTM read:
        most enterprise platforms are closed-frontier-heavy today, so the immediate Nebius wedge is the
        open-share slice and the platforms increasing it. The list narrows fast — and that&apos;s the point.
      </Insight>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-3 mt-1">
      <div className="font-serif text-[16px] font-bold text-bep-white leading-tight">{title}</div>
      <div className="text-[11px] text-bep-dim leading-relaxed">{sub}</div>
    </div>
  );
}

function BigMetric({
  value,
  label,
  sub,
  color = NEB_GREEN,
}: {
  value: string;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3">
      <div className="text-[26px] font-extrabold font-mono leading-tight" style={{ color }}>
        {value}
      </div>
      <div className="text-[10px] text-bep-muted uppercase tracking-widest mt-1">{label}</div>
      {sub && <div className="text-[10px] text-bep-dim mt-1 leading-tight">{sub}</div>}
    </div>
  );
}

function Insight({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3 text-[11px] text-bep-dim leading-relaxed font-mono mt-4">
      <span style={{ color: NEB_GREEN }}>BEP read: </span>
      {children}
    </div>
  );
}

function FooterCTA() {
  return (
    <div className="mt-10 border-t border-bep-border pt-5 pb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="text-[11px] text-bep-dim font-mono leading-relaxed max-w-[520px]">
        Methodology, source list, and the daily refresh pipeline are not published on this preview.
        Commercial terms — embed, data feed, bespoke quarterly — available on request.
      </div>
      <a
        href="mailto:ben@bepresearch.com?subject=Nebius%20preview%20%E2%80%94%20commercial%20terms"
        className="no-underline inline-block px-4 py-2 text-[12px] font-mono"
        style={{ background: NEB_GREEN, color: "#050505", borderRadius: 4, fontWeight: 700 }}
      >
        Request commercial terms →
      </a>
    </div>
  );
}

function shorten(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "…";
}

function round(v: number, dp: number): number {
  const f = Math.pow(10, dp);
  return Math.round(v * f) / f;
}
