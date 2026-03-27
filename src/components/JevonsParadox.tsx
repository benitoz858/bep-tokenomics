"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import Metric from "./ui/Metric";
import Section from "./ui/Section";
import InsightBox from "./ui/InsightBox";

const jevonsData = [
  { date: "Jan 2023", costPerMTok: 60, tokPerQuery: 500, infraDemand: 30 },
  { date: "Jul 2023", costPerMTok: 40, tokPerQuery: 800, infraDemand: 32 },
  { date: "Jan 2024", costPerMTok: 15, tokPerQuery: 1200, infraDemand: 18 },
  { date: "Jul 2024", costPerMTok: 10, tokPerQuery: 2000, infraDemand: 20 },
  { date: "Jan 2025", costPerMTok: 6, tokPerQuery: 5000, infraDemand: 30 },
  { date: "Jul 2025", costPerMTok: 3, tokPerQuery: 15000, infraDemand: 45 },
  { date: "Jan 2026", costPerMTok: 1.5, tokPerQuery: 50000, infraDemand: 75 },
  { date: "Mar 2026", costPerMTok: 0.60, tokPerQuery: 100000, infraDemand: 60 },
];

export default function JevonsParadox() {
  return (
    <div>
      <Section title="The Jevons Paradox in Action" subtitle="Cost per token falls. Tokens per query explodes. Net infrastructure demand increases. This is the core thesis from Token Explosion — cheaper tokens don't reduce demand, they create it.">
        <div className="bg-bep-card border border-bep-border rounded-md p-4">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={jevonsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a1a1a" />
              <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} />
              <YAxis
                yAxisId="cost"
                orientation="left"
                tick={{ fill: "#FF4444", fontSize: 10 }}
                tickFormatter={(v: number) => `$${v}`}
                label={{ value: "Cost/M tokens", angle: -90, position: "insideLeft", fill: "#FF4444", fontSize: 10 }}
              />
              <YAxis
                yAxisId="tokens"
                orientation="right"
                tick={{ fill: "#00D4FF", fontSize: 10 }}
                tickFormatter={(v: number) => v >= 1000 ? `${v / 1000}K` : `${v}`}
                label={{ value: "Tokens/query", angle: 90, position: "insideRight", fill: "#00D4FF", fontSize: 10 }}
              />
              <Tooltip contentStyle={{ background: "#111", border: "1px solid #252525", fontSize: 11 }} />
              <Line yAxisId="cost" type="monotone" dataKey="costPerMTok" stroke="#FF4444" strokeWidth={2.5} dot={{ r: 4 }} name="Cost/M tokens ($)" />
              <Line yAxisId="tokens" type="monotone" dataKey="tokPerQuery" stroke="#00D4FF" strokeWidth={2.5} dot={{ r: 4 }} name="Tokens/query" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid grid-cols-3 gap-2.5 mb-4">
        <Metric label="Cost Deflation" value="100x" sub="$60 → $0.60/M (3 yrs)" color="#FF4444" />
        <Metric label="Token Demand" value="200x" sub="500 → 100K tok/query" color="#00D4FF" />
        <Metric label="Net Effect" value="2x ↑" sub="Infrastructure demand grows" color="#76B900" />
      </div>

      <div className="bg-bep-card border border-bep-border rounded-md p-3.5 text-xs text-bep-dim leading-[1.7] mb-3">
        <div className="font-semibold text-bep-white mb-1.5">Three forces compounding token demand:</div>
        <div className="mb-1"><span className="text-bep-cyan">1. Reasoning models:</span> GPT-5.4 extended thinking generates 10-100x more tokens per response. Every chain-of-thought step, verification, backtrack consumes inference compute.</div>
        <div className="mb-1"><span className="text-bep-cyan">2. Agentic systems:</span> A coding agent session runs for hours, accumulating KV cache continuously. Not burst — sustained.</div>
        <div><span className="text-bep-cyan">3. Physical AI:</span> Robots navigating environments need real-time token generation at control loop frequencies. World models are memory monsters.</div>
      </div>

      <InsightBox>
        Jensen&apos;s GTC slide showed inference compute scaling 10,000x from ChatGPT to Claude Code in two years. The denominator (cost/token) falls 10x/year. The numerator (tokens/query) rises 100x. The product always grows. That&apos;s why $1T in revenue pipeline is arithmetic, not projection.
      </InsightBox>
    </div>
  );
}
