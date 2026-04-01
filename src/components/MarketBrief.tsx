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
    { regex: /(surged|spike|tightest|scarce|shortage|tight|constrained)/gi, color: "#FFB800" },
    { regex: /(\d+%\s*(?:available|availability))/g, color: "#FFB800" },
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
  { border: "#FFB80040", bg: "#FFB80006", accent: "#FFB800", label: "COMPUTE" },
  { border: "#FF444440", bg: "#FF444406", accent: "#FF4444", label: "MARGINS" },
  { border: "#76B90040", bg: "#76B90006", accent: "#76B900", label: "ACTION" },
];

export default function MarketBrief({ data }: Props) {
  if (!data) return null;

  const timeLabel = (() => {
    const d = new Date(data.generatedAt);
    const ms = Date.now() - d.getTime();
    const hrs = Math.round(ms / (1000 * 60 * 60));
    if (hrs < 1) return "just now";
    if (hrs < 24) return `${hrs}h ago`;
    // After 24h, show the date to avoid looking stale
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  })();

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-bep-green animate-pulse" />
          <span className="text-[13px] font-semibold text-bep-white">{data.title}</span>
        </div>
        <span className="text-[10px] font-mono text-bep-dim">{timeLabel}</span>
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

      {/* Bullet metrics removed — redundant with Today's Numbers and the brief itself */}
    </div>
  );
}
