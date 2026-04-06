"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  title: string;
  attribution?: { label: string; href: string };
  children: (height: number) => React.ReactNode;
  compactHeight?: number;
  expandedHeight?: number;
  footer?: React.ReactNode;
}

async function exportChart(el: HTMLElement, title: string, format: "png" | "pdf") {
  const html2canvas = (await import("html2canvas-pro")).default;

  const canvas = await html2canvas(el, {
    backgroundColor: "#0a0a0a",
    scale: 2,
    useCORS: true,
  });

  // Draw watermark
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    // Bottom-right watermark
    ctx.font = "bold 28px monospace";
    ctx.fillStyle = "rgba(118, 185, 0, 0.15)";
    ctx.textAlign = "right";
    ctx.fillText("BEP RESEARCH", canvas.width - 40, canvas.height - 50);
    ctx.font = "16px monospace";
    ctx.fillStyle = "rgba(118, 185, 0, 0.12)";
    ctx.fillText("bepresearch.com/tokenomics", canvas.width - 40, canvas.height - 25);

    // Diagonal center watermark
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(-Math.PI / 6);
    ctx.font = "bold 60px monospace";
    ctx.fillStyle = "rgba(118, 185, 0, 0.04)";
    ctx.textAlign = "center";
    ctx.fillText("BEP RESEARCH", 0, 0);
    ctx.restore();
  }

  const filename = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const date = new Date().toISOString().split("T")[0];

  if (format === "png") {
    const link = document.createElement("a");
    link.download = `bep-research-${filename}-${date}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  } else {
    // PDF via jspdf-like approach: embed canvas as image
    const { default: jsPDF } = await import("jspdf");
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const pdfWidth = 297; // A4 landscape width in mm
    const pdfHeight = (imgHeight * pdfWidth) / imgWidth;
    const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: [pdfWidth, pdfHeight] });
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`bep-research-${filename}-${date}.pdf`);
  }
}

export default function ExpandableChart({ title, attribution, children, compactHeight = 160, expandedHeight = 480, footer }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleExport = useCallback(async (format: "png" | "pdf") => {
    if (!chartRef.current || exporting) return;
    setExporting(true);
    try {
      await exportChart(chartRef.current, title, format);
    } catch (err) {
      console.error("Export failed:", err);
    }
    setExporting(false);
  }, [title, exporting]);

  if (expanded) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
        onClick={() => setExpanded(false)}>
        <div className="w-[95vw] max-w-[1200px] bg-[#0a0a0a] border border-bep-border rounded-lg p-5"
          onClick={(e) => e.stopPropagation()}>
          {/* Capture area */}
          <div ref={chartRef}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-mono text-bep-muted uppercase tracking-wider">{title}</div>
              <div className="flex items-center gap-2">
                {attribution && (
                  <a href={attribution.href} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-bep-cyan no-underline hover:underline">{attribution.label}</a>
                )}
              </div>
            </div>
            {children(expandedHeight)}
            {footer && <div className="mt-3">{footer}</div>}
            {/* Visible watermark in export area */}
            <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#1a1a1a]">
              <div className="text-[9px] font-mono" style={{ color: "#76B90040" }}>BEP RESEARCH · bepresearch.com/tokenomics</div>
              <div className="text-[9px] font-mono" style={{ color: "#76B90040" }}>{new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
            </div>
          </div>
          {/* Action buttons outside capture area */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button onClick={() => handleExport("png")} disabled={exporting}
                className="text-[10px] font-mono text-bep-dim hover:text-bep-white px-3 py-1.5 rounded border border-bep-border hover:border-bep-dim bg-[#111] hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">
                {exporting ? "Exporting..." : "Save PNG"}
              </button>
              <button onClick={() => handleExport("pdf")} disabled={exporting}
                className="text-[10px] font-mono text-bep-dim hover:text-bep-white px-3 py-1.5 rounded border border-bep-border hover:border-bep-dim bg-[#111] hover:bg-[#1a1a1a] transition-colors disabled:opacity-40">
                {exporting ? "Exporting..." : "Save PDF"}
              </button>
            </div>
            <button onClick={() => setExpanded(false)} className="text-[10px] font-mono text-bep-dim hover:text-bep-white transition-colors px-3 py-1.5 rounded border border-bep-border">
              Close
            </button>
          </div>
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
