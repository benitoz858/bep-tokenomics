"use client";

interface CommentaryData {
  generatedAt: string;
  date: string;
  title: string;
  poweredBy?: string;
  summary: string;
  paragraphs: string[];
  bullets: string[];
  dataPoints: {
    modelsTracked: number;
    gpuMarketsTracked: number;
    llmflationIndex: number | null;
    gpuOffers: number;
  };
}

interface Props {
  data: CommentaryData | null;
}

// Color-code severity words in text
function colorize(text: string): JSX.Element[] {
  const patterns: Array<{ regex: RegExp; color: string }> = [
    { regex: /(-\d+\.?\d*%\s*margin|-\d+%)/g, color: "#FF4444" },
    { regex: /(hemorrhaging|burning cash|loss of|selling at a loss|Burning Cash)/gi, color: "#FF4444" },
    { regex: /(\d+\.?\d*%\s*margin|Strong)/g, color: "#76B900" },
    { regex: /(surged|spike|tightest)/gi, color: "#FFB800" },
    { regex: /(\$[\d,.]+\/M\s*(?:output|tokens?)|\$[\d,.]+\/hr)/g, color: "#00D4FF" },
    { regex: /(undervalued|best.*value)/gi, color: "#76B900" },
    { regex: /(overvalued|overpriced)/gi, color: "#FF4444" },
    { regex: /(Neutral)/g, color: "#FFB800" },
    { regex: /(Weak)/g, color: "#FF6B6B" },
  ];

  // Simple approach: split by sentences and color key terms
  const parts: JSX.Element[] = [];
  let remaining = text;
  let key = 0;

  // Find all matches and their positions
  const allMatches: Array<{ start: number; end: number; text: string; color: string }> = [];
  for (const { regex, color } of patterns) {
    let match;
    const r = new RegExp(regex.source, regex.flags);
    while ((match = r.exec(text)) !== null) {
      allMatches.push({ start: match.index, end: match.index + match[0].length, text: match[0], color });
    }
  }

  // Sort by position and deduplicate overlaps
  allMatches.sort((a, b) => a.start - b.start);
  const filtered: typeof allMatches = [];
  let lastEnd = 0;
  for (const m of allMatches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }

  let pos = 0;
  for (const m of filtered) {
    if (m.start > pos) {
      parts.push(<span key={key++}>{text.slice(pos, m.start)}</span>);
    }
    parts.push(<span key={key++} style={{ color: m.color, fontWeight: 600 }}>{m.text}</span>);
    pos = m.end;
  }
  if (pos < text.length) {
    parts.push(<span key={key++}>{text.slice(pos)}</span>);
  }

  return parts;
}

const CARD_STYLES = [
  { border: "#FFB80040", bg: "#FFB80006", accent: "#FFB800", label: "SIGNAL" },
  { border: "#FF444440", bg: "#FF444406", accent: "#FF4444", label: "MARGINS" },
  { border: "#76B90040", bg: "#76B90006", accent: "#76B900", label: "ACTION" },
];

export default function MarketBrief({ data }: Props) {
  if (!data) return null;

  const timeAgo = (() => {
    const ms = Date.now() - new Date(data.generatedAt).getTime();
    const hrs = Math.round(ms / (1000 * 60 * 60));
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.round(hrs / 24)}d ago`;
  })();

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bep-green animate-pulse" />
          <span className="text-[13px] font-semibold text-bep-white">{data.title}</span>
        </div>
        <div className="flex items-center gap-2">
          {data.poweredBy && (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#A855F710] border border-[#A855F730] text-[#A855F7]">
              {data.poweredBy}
            </span>
          )}
          <span className="text-[10px] font-mono text-bep-dim">{timeAgo}</span>
        </div>
      </div>

      {/* Paragraph cards */}
      <div className="space-y-2 mb-3">
        {data.paragraphs.map((p, i) => {
          const style = CARD_STYLES[i] || CARD_STYLES[0];
          return (
            <div key={i} className="rounded-md px-4 py-3 border" style={{ background: style.bg, borderColor: style.border }}>
              <div className="flex items-start gap-3">
                <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 tracking-wider"
                  style={{ background: style.accent + "18", color: style.accent, border: `1px solid ${style.accent}35` }}>
                  {style.label}
                </span>
                <p className="text-[12.5px] leading-[1.7] text-bep-text">
                  {colorize(p)}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bullet metric cards */}
      <div className="grid grid-cols-3 gap-1.5">
        {data.bullets.map((b, i) => {
          // Extract the leading number/dollar amount
          const numMatch = b.match(/^([\$\d][^\s]*)/);
          const num = numMatch ? numMatch[1] : "";
          const rest = num ? b.slice(num.length).trim() : b;

          const colors = ["#00D4FF", "#76B900", "#FFB800", "#FF4444", "#A855F7", "#EC4899"];
          const color = colors[i % colors.length];

          return (
            <div key={i} className="bg-bep-card border border-bep-border rounded px-3 py-2">
              {num && (
                <div className="text-[15px] font-bold font-mono" style={{ color }}>{num}</div>
              )}
              <div className="text-[10px] text-bep-dim leading-snug mt-0.5">{rest}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
