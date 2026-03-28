"use client";

import Link from "next/link";

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function SubPageShell({ title, children }: Props) {
  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      <div className="px-6 pt-5 pb-3 border-b border-bep-border">
        <div className="flex items-center gap-3">
          <Link href="/tokenomics" className="flex items-center gap-2 text-bep-dim hover:text-bep-white transition-colors no-underline">
            <span className="text-sm">←</span>
            <div className="relative w-6 h-6 flex-shrink-0">
              <img src="/bep-icon.png" alt="BEP Research" width={24} height={24} style={{ filter: "brightness(1.2)", borderRadius: 3 }} />
            </div>
            <span className="text-[11px] font-mono">The Stack</span>
          </Link>
          <span className="text-bep-border">/</span>
          <span className="font-sans text-[16px] font-bold">{title}</span>
        </div>
      </div>
      <div className="px-6 py-5 max-w-[920px]">
        {children}
        <div className="mt-8 pt-4 border-t border-bep-border">
          <Link href="/tokenomics" className="text-[11px] font-mono text-bep-green hover:underline no-underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
