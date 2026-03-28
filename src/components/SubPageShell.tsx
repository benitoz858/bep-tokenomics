"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/tokenomics", label: "Overview" },
  { href: "/tokenomics/margins", label: "Margin Calculator" },
  { href: "/tokenomics/tco", label: "Cluster TCO" },
  { href: "/tokenomics/waterfall", label: "Waterfall" },
  { href: "/tokenomics/hardware", label: "Hardware" },
  { href: "/tokenomics/deep-dive", label: "Deep Dive" },
  { href: "/tokenomics/sources", label: "Sources" },
];

interface Props {
  title: string;
  children: React.ReactNode;
}

export default function SubPageShell({ title, children }: Props) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen" style={{ background: "#050505", color: "#f0f0f0" }}>
      <div className="sticky top-0 z-50 px-6 pt-4 pb-0 border-b border-bep-border" style={{ background: "#050505ee", backdropFilter: "blur(12px)" }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Link href="/tokenomics" className="no-underline flex items-center gap-2">
              <div className="relative w-7 h-7 flex-shrink-0">
                <img src="/bep-icon.png" alt="BEP Research" width={28} height={28} style={{ filter: "brightness(1.2)", borderRadius: 4 }} />
              </div>
              <div>
                <span className="font-sans text-[17px] font-extrabold tracking-tight text-bep-white">The Stack</span>
                <span className="text-[9px] text-bep-muted font-mono tracking-widest ml-2">BEP RESEARCH</span>
              </div>
            </Link>
          </div>
          <div className="text-[10px] font-mono text-bep-dim">
            by Ben Pouladian
          </div>
        </div>
        <div className="flex gap-0 overflow-x-auto -mb-px">
          {TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link key={tab.href} href={tab.href} className="no-underline">
                <div className="px-3 py-2 text-[11px] font-mono whitespace-nowrap cursor-pointer transition-colors"
                  style={{
                    color: active ? "#f0f0f0" : "#666",
                    fontWeight: active ? 600 : 400,
                    borderBottom: active ? "2px solid #76B900" : "2px solid transparent",
                  }}>
                  {tab.label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="px-6 py-5 max-w-[920px]">
        {children}
        <div className="mt-8 pt-4 border-t border-bep-border flex items-center justify-between">
          <span className="text-[9px] font-mono" style={{ color: "rgba(102,102,102,0.3)", letterSpacing: 2 }}>
            BEP RESEARCH &copy; 2026
          </span>
          <span className="text-[10px] font-mono text-bep-dim">
            Updated daily 6AM UTC · <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer" className="text-bep-green hover:underline">Substack</a>
          </span>
        </div>
      </div>
    </div>
  );
}
