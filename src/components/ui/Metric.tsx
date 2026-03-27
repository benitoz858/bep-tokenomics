"use client";

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}

export default function Metric({ label, value, sub, color = "#76B900" }: MetricProps) {
  return (
    <div className="bg-bep-card border border-bep-border rounded-md p-3 text-center">
      <div className="text-[22px] font-extrabold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-bep-muted uppercase tracking-widest mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-bep-dim mt-1">{sub}</div>}
    </div>
  );
}
