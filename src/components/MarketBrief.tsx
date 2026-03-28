"use client";

interface CommentaryData {
  generatedAt: string;
  date: string;
  title: string;
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
      <div className="bg-bep-card border border-bep-border rounded-md overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-bep-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-bep-green animate-pulse" />
            <span className="text-[13px] font-semibold text-bep-white">{data.title}</span>
          </div>
          <span className="text-[10px] font-mono text-bep-dim">{timeAgo} · {data.dataPoints.modelsTracked} models · {data.dataPoints.gpuOffers} GPU offers</span>
        </div>

        {/* Body */}
        <div className="px-4 py-3">
          {data.paragraphs.map((p, i) => (
            <p key={i} className="text-[12.5px] leading-[1.7] mb-3 last:mb-0" style={{
              color: i === 0 ? "#f0f0f0" : i === data.paragraphs.length - 1 ? "#76B900" : "#bbb",
              fontWeight: i === 0 ? 500 : i === data.paragraphs.length - 1 ? 500 : 400,
              fontStyle: i === data.paragraphs.length - 1 ? "italic" : "normal",
            }}>
              {p}
            </p>
          ))}

          {/* Bullets */}
          {data.bullets.length > 0 && (
            <div className="mt-3 pt-3 border-t border-bep-border">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {data.bullets.map((b, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px] text-bep-dim font-mono">
                    <span className="text-bep-muted mt-0.5">·</span>
                    <span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
