"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import { formatPrice } from "@/lib/calculations";

export interface CatalogEntry {
  model: string;
  modelId: string;
  provider: string;
  inputPerMillion: number;
  outputPerMillion: number;
  contextWindow: number;
}

export interface PlatformExposure {
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
  catalogSize: number;
  floor: { display: string; modelId: string; outputPerMillion: number } | null;
  distinctCreators: number;
  maxContext: number;
  maxContextModel: { display: string; modelId: string } | null;
  platforms: PlatformExposure[];
  platformsAddressableNow: number;
  trajectory: Array<{ date: string; floor: number }>;
}

const NEB_GREEN = "#76B900";

type TabId = "headline" | "catalog" | "platforms";

const TABS: Array<{ id: TabId; label: string; sub: string }> = [
  { id: "headline", label: "01 · Headline", sub: "catalog at a glance" },
  { id: "catalog", label: "02 · Catalog", sub: "all 30 models, priced" },
  { id: "platforms", label: "03 · Platforms", sub: "enterprise exposure" },
];

export default function NebiusPreview(props: NebiusPreviewProps) {
  const [tab, setTab] = useState<TabId>("headline");
  const dateStr = new Date(props.generatedAt).toUTCString().slice(5, 16).trim();

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      <ConfidentialBand dateStr={dateStr} />

      <div className="px-6 pt-5 pb-4 max-w-[960px] mx-auto">
        <div className="flex items-baseline justify-between mb-1">
          <div className="font-serif text-[28px] font-bold text-bep-white leading-tight">
            Nebius · cost-per-token, the independent view
          </div>
          <div className="text-[10px] font-mono text-bep-dim hidden sm:block">
            Prepared by BEP Research
          </div>
        </div>
        <div className="text-[12px] text-bep-dim leading-relaxed max-w-[680px]">
          Independent measurement of the Nebius Token Factory catalog, computed daily from the
          live pricing API. Three views: the topline numbers describing the catalog, the full
          model-by-model breakdown, and how enterprise platforms in the BEP panel are positioned
          relative to the open-weights models Nebius hosts today.
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
          {tab === "headline" && <HeadlineTab {...props} />}
          {tab === "catalog" && <CatalogTab {...props} />}
          {tab === "platforms" && <PlatformsTab {...props} />}
        </div>

        <Footer />
      </div>
    </div>
  );
}

function ConfidentialBand({ dateStr }: { dateStr: string }) {
  return (
    <div
      className="w-full px-6 py-1.5 text-center text-[10px] font-mono tracking-[0.18em] uppercase"
      style={{ background: "#1a1100", color: "#FFB800", borderBottom: "1px solid #2a1d00" }}
    >
      Preview for Nebius · Confidential · Not for distribution · Snapshot {dateStr}
    </div>
  );
}

function HeadlineTab(p: NebiusPreviewProps) {
  const distribution = p.catalog.map((m) => ({
    name: shorten(m.modelId.split("/").pop() || m.modelId, 28),
    output: round(m.outputPerMillion, 3),
  }));

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <BigMetric value={p.catalogSize.toString()} label="Open models live" sub="Nebius Token Factory" />
        <BigMetric
          value={p.floor ? `$${p.floor.outputPerMillion.toFixed(2)}` : "—"}
          label="Output floor / M tok"
          sub={p.floor?.display ? shorten(p.floor.display, 32) : ""}
        />
        <BigMetric
          value={p.distinctCreators.toString()}
          label="Model creators"
          sub="Meta · DeepSeek · Qwen · NVIDIA · …"
          color="#00D4FF"
        />
        <BigMetric
          value={p.maxContext >= 1_000_000 ? `${(p.maxContext / 1_000_000).toFixed(1)}M` : `${Math.round(p.maxContext / 1000)}K`}
          label="Max context / token"
          sub={p.maxContextModel ? shorten(p.maxContextModel.display, 32) : ""}
          color="#A855F7"
        />
      </div>

      <div className="bg-bep-card border border-bep-border rounded-md p-4 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-bep-muted mb-2">
          Topline
        </div>
        <div className="font-serif text-[18px] leading-snug text-bep-white">
          {p.floor && p.maxContextModel ? (
            <>
              Nebius Token Factory currently lists <span style={{ color: NEB_GREEN }}>{p.catalogSize} open-weights models</span> from{" "}
              <span style={{ color: NEB_GREEN }}>{p.distinctCreators} model creators</span> — Meta, DeepSeek, Qwen, NVIDIA, MiniMax,
              Moonshot, Z.ai and others. Pricing starts at a floor of{" "}
              <span style={{ color: NEB_GREEN }}>${p.floor.outputPerMillion.toFixed(2)} per million output tokens</span>{" "}
              and the catalog extends to a {p.maxContext >= 1_000_000 ? `${(p.maxContext / 1_000_000).toFixed(1)}M-token` : `${Math.round(p.maxContext / 1000)}K-token`} context window for long-context workloads — the broadest open-weights coverage in this market panel.
            </>
          ) : (
            <>Catalog metrics will populate once the next pricing snapshot lands.</>
          )}
        </div>
      </div>

      <SectionHeader
        title="Catalog price distribution"
        sub={`All ${p.catalogSize} Nebius-hosted models, output rate ascending. Bars in green denote the sub-$0.50/M cluster — the high-volume tier.`}
      />
      <div className="bg-bep-card border border-bep-border rounded-md p-3">
        <div style={{ width: "100%", height: Math.max(220, distribution.length * 22) }}>
          <ResponsiveContainer>
            <BarChart data={distribution} layout="vertical" margin={{ top: 5, right: 25, left: 0, bottom: 5 }}>
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
                tick={{ fontSize: 9, fontFamily: "monospace" }}
                width={190}
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
              <Bar dataKey="output" radius={[0, 2, 2, 0]}>
                {distribution.map((d, i) => (
                  <Cell key={i} fill={d.output < 0.5 ? NEB_GREEN : "#3a4a1a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] font-mono text-bep-dim mt-2">
          $/M output tokens · brighter green = sub-$0.50/M tier
        </div>
      </div>

      {p.trajectory.length > 1 && (
        <>
          <div className="mt-6" />
          <SectionHeader
            title="Nebius output floor — daily trajectory"
            sub="Lowest $/M output rate Nebius has offered, per day, across the catalog we observe."
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

      <Note>
        Numbers refresh daily from the Token Factory API; the catalog distribution chart is
        re-rendered from each snapshot, never a synthesized series. Where supply-side coverage
        (silicon, capex, datacenter) sits with other research, the catalog view above is intended
        to be quoted publicly without compromising commercial sensitivity.
      </Note>
    </div>
  );
}

function CatalogTab(p: NebiusPreviewProps) {
  return (
    <div>
      <SectionHeader
        title="Nebius Token Factory · full catalog"
        sub={`${p.catalog.length} generative models, ordered by output rate ascending. Context window shown for sizing long-context workloads.`}
      />
      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
          <div className="col-span-5">Model</div>
          <div className="col-span-2">Creator</div>
          <div className="col-span-2 text-right">$/M in</div>
          <div className="col-span-2 text-right">$/M out</div>
          <div className="col-span-1 text-right">Context</div>
        </div>
        {p.catalog.map((m) => (
          <div
            key={m.modelId}
            className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
          >
            <div className="col-span-5 text-bep-white truncate" title={m.modelId}>
              {m.model}
            </div>
            <div className="col-span-2 text-bep-dim">{m.provider}</div>
            <div className="col-span-2 text-right text-bep-text">{formatPrice(m.inputPerMillion)}</div>
            <div className="col-span-2 text-right text-bep-text">{formatPrice(m.outputPerMillion)}</div>
            <div className="col-span-1 text-right text-bep-dim">
              {m.contextWindow >= 1_000_000
                ? `${(m.contextWindow / 1_000_000).toFixed(1)}M`
                : m.contextWindow >= 1000
                  ? `${Math.round(m.contextWindow / 1000)}K`
                  : m.contextWindow.toString()}
            </div>
          </div>
        ))}
      </div>

      <Note>
        Catalog reflects the live Token Factory `/v1/models` endpoint at the snapshot time above.
        Embedding and non-generative models are excluded — only models that produce output tokens
        are listed, so output-rate comparisons are meaningful.
      </Note>
    </div>
  );
}

function PlatformsTab(p: NebiusPreviewProps) {
  const platforms = p.platforms;
  return (
    <div>
      <SectionHeader
        title="Open-model exposure across the BEP enterprise panel"
        sub={`${platforms.length} enterprise / agent platforms, ranked by open-weights share of disclosed model mix. Today, ${p.platformsAddressableNow} of ${platforms.length} route at least one open-weights model Nebius hosts directly — both are data-cloud platforms (Snowflake, Databricks).`}
      />
      <div className="bg-bep-card border border-bep-border rounded-md p-3 mb-4">
        <div style={{ width: "100%", height: Math.max(280, platforms.length * 28) }}>
          <ResponsiveContainer>
            <BarChart
              data={platforms.map((pl) => ({
                name: pl.name,
                "Open weights": round(pl.openShare * 100, 1),
                "Closed frontier": round(pl.closedShare * 100, 1),
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
                width={140}
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
              <Bar dataKey="Open weights" stackId="mix" fill={NEB_GREEN} />
              <Bar dataKey="Closed frontier" stackId="mix" fill="#444" />
              <Bar dataKey="Proprietary" stackId="mix" fill="#A855F7" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-[10px] font-mono text-bep-dim mt-2">
          Share of each platform&apos;s disclosed model mix · green = open weights · grey = closed frontier (OpenAI / Anthropic / Google / xAI) · purple = vendor-proprietary
        </div>
      </div>

      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        <div className="grid grid-cols-12 px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-bep-muted border-b border-bep-border">
          <div className="col-span-3">Platform</div>
          <div className="col-span-2">Vendor</div>
          <div className="col-span-2">Pricing tier</div>
          <div className="col-span-2 text-right">Open share</div>
          <div className="col-span-3">Nebius-hosted models routed</div>
        </div>
        {platforms.map((pl) => (
          <div
            key={pl.id}
            className="grid grid-cols-12 px-3 py-2 text-[11px] font-mono border-b border-bep-border"
            style={{ background: pl.matchedModels.length > 0 ? "rgba(118,185,0,0.05)" : "transparent" }}
          >
            <div className="col-span-3 text-bep-white">{pl.name}</div>
            <div className="col-span-2 text-bep-dim">{pl.vendor}</div>
            <div className="col-span-2 text-bep-dim">{pl.tier}</div>
            <div
              className="col-span-2 text-right"
              style={{ color: pl.openShare > 0 ? NEB_GREEN : "#444" }}
            >
              {pl.openShare > 0 ? `${(pl.openShare * 100).toFixed(0)}%` : "—"}
            </div>
            <div className="col-span-3 text-bep-text truncate" title={pl.matchedModels.join(", ")}>
              {pl.matchedModels.length > 0 ? pl.matchedModels.slice(0, 2).join(", ") : "—"}
            </div>
          </div>
        ))}
      </div>

      <Note>
        Enterprise AI today is overwhelmingly closed-frontier — the immediate Nebius foothold sits
        with the data-cloud platforms that have already moved a slice of their mix to open weights.
        The other rows represent the growth surface as enterprise platforms diversify away from
        single-frontier dependence.
      </Note>
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

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3 text-[11px] text-bep-dim leading-relaxed font-mono mt-4">
      <span style={{ color: NEB_GREEN }}>Note · </span>
      {children}
    </div>
  );
}

function Footer() {
  return (
    <div className="mt-10 border-t border-bep-border pt-5 pb-8">
      <div className="text-[11px] text-bep-dim font-mono leading-relaxed max-w-[680px]">
        Numbers above refresh daily. Full source panel, refresh methodology, and tailored cuts
        (Nebius-branded embed, weekly data feed, quarterly written report) available on request.
        Prepared by Ben Pouladian, BEP Research.
      </div>
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
