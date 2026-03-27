"use client";

interface SectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function Section({ title, subtitle, children }: SectionProps) {
  return (
    <div className="mb-7">
      <div className="font-serif text-lg font-bold text-bep-white mb-1">{title}</div>
      {subtitle && <div className="text-xs text-bep-dim mb-3.5 leading-relaxed">{subtitle}</div>}
      {children}
    </div>
  );
}
