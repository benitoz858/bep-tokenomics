"use client";

import { useState } from "react";

interface Props {
  title: string;
  attribution?: { label: string; href: string };
  children: (height: number) => React.ReactNode;
  compactHeight?: number;
  expandedHeight?: number;
  footer?: React.ReactNode;
}

export default function ExpandableChart({ title, attribution, children, compactHeight = 160, expandedHeight = 480, footer }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        onClick={() => setExpanded(false)}>
        <div className="w-[95vw] max-w-[1200px] bg-[#0a0a0a] border border-bep-border rounded-lg p-5"
          onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-mono text-bep-muted uppercase tracking-wider">{title}</div>
            <div className="flex items-center gap-3">
              {attribution && (
                <a href={attribution.href} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-bep-cyan no-underline hover:underline">{attribution.label}</a>
              )}
              <button onClick={() => setExpanded(false)} className="text-[10px] font-mono text-bep-dim hover:text-bep-white transition-colors px-2 py-1 rounded border border-bep-border">
                ESC
              </button>
            </div>
          </div>
          {children(expandedHeight)}
          {footer && <div className="mt-3">{footer}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3 relative">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[9px] font-mono text-bep-muted uppercase tracking-wider">{title}</div>
        <div className="flex items-center gap-2">
          {attribution && (
            <a href={attribution.href} target="_blank" rel="noopener noreferrer" className="text-[8px] font-mono text-bep-cyan no-underline hover:underline">{attribution.label}</a>
          )}
          <button onClick={() => setExpanded(true)}
            className="text-[9px] font-mono text-bep-dim hover:text-bep-white px-1.5 py-0.5 rounded border border-bep-border hover:border-bep-dim bg-[#111] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            title="Expand chart">
            Expand
          </button>
        </div>
      </div>
      {children(compactHeight)}
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}
