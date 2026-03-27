"use client";

interface InsightBoxProps {
  children: React.ReactNode;
}

export default function InsightBox({ children }: InsightBoxProps) {
  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3 text-[11px] text-bep-dim leading-relaxed font-mono">
      <span className="text-bep-green">BEP Insight: </span>
      {children}
    </div>
  );
}
