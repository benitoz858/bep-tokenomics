import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "BEP Research — AI Infrastructure Intelligence by Ben Pouladian";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background:
            "radial-gradient(circle at 20% 0%, #0d1f1a 0%, #050505 55%), #050505",
          color: "#f0f0f0",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: 6,
              color: "#76B900",
              fontWeight: 600,
            }}
          >
            BEP RESEARCH
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              color: "#ffffff",
              maxWidth: 980,
            }}
          >
            AI Infrastructure Intelligence
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#a0a0a0",
              lineHeight: 1.35,
              maxWidth: 960,
            }}
          >
            System-level research on semiconductors, memory, optical interconnects, NeoCloud datacenters, and the unit economics of intelligence.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            borderTop: "1px solid #1a1a1a",
            paddingTop: 22,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 22, color: "#cccccc", fontWeight: 600 }}>
              Ben Pouladian
            </div>
            <div style={{ fontSize: 16, color: "#666666", letterSpacing: 2 }}>
              INDEPENDENT RESEARCH
            </div>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            {[
              { label: "Co-Design", color: "#76B900" },
              { label: "HBM", color: "#00D4FF" },
              { label: "Optical", color: "#A855F7" },
              { label: "Power", color: "#FF4444" },
            ].map((tag) => (
              <div
                key={tag.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 14px",
                  border: `1px solid ${tag.color}55`,
                  borderRadius: 6,
                  background: `${tag.color}12`,
                  color: tag.color,
                  fontSize: 16,
                  fontWeight: 600,
                  letterSpacing: 1,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: tag.color,
                  }}
                />
                {tag.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
