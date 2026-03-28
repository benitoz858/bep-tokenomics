"use client";

import Link from "next/link";

export default function Home() {
  return (
    <div style={{ background: "#050505", minHeight: "100vh", color: "#f0f0f0", fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "80px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 12 }}>
            <div style={{ position: "relative", width: 48, height: 48 }}>
              <img src="/bep-icon.png" alt="BEP Research logo by Ben Pouladian" width={48} height={48} style={{ filter: "brightness(1.2)", borderRadius: 6 }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #76B90020, #00D4FF20)", borderRadius: 6, mixBlendMode: "overlay" }} />
            </div>
            <div>
              <h1 style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 36, fontWeight: 800, marginBottom: 2, lineHeight: 1.1, letterSpacing: -0.5 }}>
                BEP Research
              </h1>
              <p style={{ fontSize: 12, color: "#666", fontFamily: "'JetBrains Mono', monospace", letterSpacing: 2 }}>
                SYSTEM-LEVEL AI INFRASTRUCTURE INTELLIGENCE
              </p>
            </div>
          </div>
        </div>

        {/* About */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 16, color: "#ccc", lineHeight: 1.8, marginBottom: 16 }}>
            Independent research covering the full AI infrastructure stack — from silicon architecture to software optimization to business model.
            Every layer of the stack connects. The constraint in one layer becomes the opportunity in the next.
          </p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7 }}>
            By <span style={{ color: "#f0f0f0", fontWeight: 600 }}>Ben Pouladian</span>
          </p>
        </div>

        {/* Research Products */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#f0f0f0" }}>
            Research
          </h2>

          <Link href="/tokenomics" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "24px 28px",
              marginBottom: 12, cursor: "pointer", transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#76B900")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>
                  The Stack
                </span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#76B900", letterSpacing: 1, padding: "2px 8px", border: "1px solid #76B90040", borderRadius: 4, background: "#76B90010" }}>
                  LIVE DATA
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, margin: 0 }}>
                AI infrastructure unit economics — live token pricing, GPU cloud costs, inference margins, cluster TCO, and lab margin analysis. Updated daily.
              </p>
            </div>
          </Link>

          <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{
              background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "24px 28px",
              marginBottom: 12, cursor: "pointer", transition: "border-color 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#00D4FF")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1a1a1a")}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 18, fontWeight: 700, color: "#f0f0f0" }}>
                  Substack
                </span>
                <span style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: "#00D4FF", letterSpacing: 1, padding: "2px 8px", border: "1px solid #00D4FF40", borderRadius: 4, background: "#00D4FF10" }}>
                  46 POSTS
                </span>
              </div>
              <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6, margin: 0 }}>
                Deep-dive analysis on AI semiconductors, optical interconnects, memory architecture, and the companies building the physical layer of intelligence.
              </p>
            </div>
          </a>
        </div>

        {/* Thesis Areas */}
        <div style={{ marginBottom: 48 }}>
          <h2 style={{ fontFamily: "'Inter', -apple-system, sans-serif", fontSize: 20, fontWeight: 700, marginBottom: 20, color: "#f0f0f0" }}>
            Coverage
          </h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              { label: "Co-Design Architecture", color: "#76B900" },
              { label: "Memory & HBM Economics", color: "#00D4FF" },
              { label: "Optical Interconnects", color: "#A855F7" },
              { label: "Advanced Packaging", color: "#FFB800" },
              { label: "NeoCloud Infrastructure", color: "#EC4899" },
              { label: "Datacenter Power", color: "#FF4444" },
            ].map((item) => (
              <div key={item.label} style={{
                padding: "10px 14px", background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 6,
                fontSize: 12, color: "#999", display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #1a1a1a", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", color: "#444", letterSpacing: 2 }}>
            BEP RESEARCH &copy; 2026
          </span>
          <div style={{ display: "flex", gap: 16 }}>
            <a href="https://bepresearch.substack.com" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#666", textDecoration: "none", fontFamily: "'JetBrains Mono', monospace" }}>
              Substack
            </a>
            <a href="https://x.com/baborges10" target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11, color: "#666", textDecoration: "none", fontFamily: "'JetBrains Mono', monospace" }}>
              X
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
