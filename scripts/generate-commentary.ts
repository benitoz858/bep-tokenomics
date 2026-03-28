/**
 * BEP Research — Market Commentary Generator (Claude-powered)
 *
 * Reads all live data, feeds it to Claude Opus 4.6, generates analyst-style market brief.
 * Falls back to rule-based generation if no API key is set.
 *
 * Requires: ANTHROPIC_API_KEY env var
 * Run after fetch scripts in the daily cron.
 * Output: data/commentary/latest.json
 */

import Anthropic from "@anthropic-ai/sdk";
import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

interface TokenModel {
  model: string; modelId: string; provider: string;
  inputPerMillion: number; outputPerMillion: number;
}
interface GPUSummary {
  gpuModel: string;
  spot: { min: number | null; median: number | null; max: number | null; count: number };
  onDemand: { min: number | null; median: number | null; max: number | null; count: number };
  availabilityPct: number; totalGpusAvailable: number; totalGpusRented: number;
}

function buildDataContext(): string {
  const tokenData = readJSON<{ models: TokenModel[]; fetchedAt: string }>(dataPath("token-pricing", "current.json"));
  const gpuData = readJSON<{ summaries: GPUSummary[]; fetchedAt: string }>(dataPath("gpu-pricing", "current.json"));
  const llmflation = readJSON<{ currentIndex: number; components: Record<string, number | null> }>(dataPath("indices", "llmflation.json"));
  const margins = readJSON<{ margins: Array<{ gpuModel: string; costPerMillionTokens: number; margins: Array<{ tier: string; margin: number }> }> }>(dataPath("indices", "inference-margin.json"));
  const gpuHistory = readJSON<{ entries: Record<string, GPUSummary[]> }>(dataPath("gpu-pricing", "history.json"));
  const tokenHistory = readJSON<{ entries: Record<string, Array<{ modelId: string; outputPerMillion: number }>> }>(dataPath("token-pricing", "history.json"));

  const sections: string[] = [];

  sections.push(`## Date: ${todayISO()}`);

  if (llmflation) {
    sections.push(`## LLMflation Index\nCurrent: ${llmflation.currentIndex} (base 100 = GPT-4 launch Mar 2023, $60/M output)\nComponents: ${JSON.stringify(llmflation.components)}`);
  }

  if (tokenData?.models) {
    const models = tokenData.models.sort((a, b) => b.outputPerMillion - a.outputPerMillion);
    sections.push(`## Token Pricing (${models.length} models)\n${models.map(m => `${m.model} (${m.provider}): input $${m.inputPerMillion}/M, output $${m.outputPerMillion}/M`).join("\n")}`);
  }

  if (gpuData?.summaries) {
    const gpus = gpuData.summaries.filter(g => g.spot.median || g.onDemand.median);
    sections.push(`## GPU Spot Market\n${gpus.map(g => {
      const name = g.gpuModel.replace("nvidia-", "").replace("amd-", "").toUpperCase();
      const total = g.totalGpusAvailable + g.totalGpusRented;
      return `${name}: spot median $${g.spot.median?.toFixed(2) || "N/A"}/hr, ${g.availabilityPct}% avail (${g.totalGpusAvailable}/${total} GPUs), range $${g.spot.min?.toFixed(2) || "?"}-$${g.spot.max?.toFixed(2) || "?"}/hr`;
    }).join("\n")}`);
  }

  if (margins?.margins) {
    sections.push(`## Inference Margins (Llama 70B reference)\n${margins.margins.map(m => {
      const name = m.gpuModel.replace("nvidia-", "").replace("amd-", "").toUpperCase();
      const tierStr = m.margins.map(t => `${t.tier}: ${t.margin.toFixed(0)}%`).join(", ");
      return `${name}: cost $${m.costPerMillionTokens.toFixed(2)}/M tokens → ${tierStr}`;
    }).join("\n")}`);
  }

  if (gpuHistory?.entries) {
    const dates = Object.keys(gpuHistory.entries).sort();
    if (dates.length >= 2) {
      const latest = gpuHistory.entries[dates[dates.length - 1]];
      const prior = gpuHistory.entries[dates[dates.length - 2]];
      const changes: string[] = [];
      for (const gpu of latest) {
        const old = prior?.find(p => p.gpuModel === gpu.gpuModel);
        if (old?.spot.median && gpu.spot.median) {
          const change = ((gpu.spot.median - old.spot.median) / old.spot.median) * 100;
          if (Math.abs(change) > 1) {
            changes.push(`${gpu.gpuModel.replace("nvidia-","").toUpperCase()}: ${change > 0 ? "+" : ""}${change.toFixed(1)}% ($${old.spot.median.toFixed(2)} → $${gpu.spot.median.toFixed(2)})`);
          }
        }
      }
      if (changes.length) sections.push(`## Day-over-Day GPU Price Changes\n${changes.join("\n")}`);
    }
  }

  if (tokenHistory?.entries) {
    const dates = Object.keys(tokenHistory.entries).sort();
    sections.push(`## Token Price History: ${dates.length} data points from ${dates[0]} to ${dates[dates.length - 1]}`);
  }

  return sections.join("\n\n");
}

async function generateWithClaude(dataContext: string): Promise<{ paragraphs: string[]; bullets: string[] }> {
  const client = new Anthropic();

  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 2500,
    messages: [{
      role: "user",
      content: `You are a senior data scientist and quantitative analyst at BEP Research. Your job is to analyze the AI infrastructure market using live data — no narratives, no hype, just what the numbers say. You are completely unbiased. You have no affiliation with any provider. You call out every company equally — OpenAI, Anthropic, Google, DeepSeek, Meta, xAI, and every GPU cloud provider. If Anthropic is overpriced, say so. If DeepSeek is subsidizing, quantify it. If OpenAI's spread is unsustainable, flag it.

Here is today's live data:

${dataContext}

Write a market brief with:
1. 5-6 short paragraphs (2-3 sentences each). Structure:
   - Para 1: The single most important signal in today's data. What changed, what's anomalous, what matters.
   - Para 2: Token pricing analysis. Who's expensive, who's cheap, who's below production cost, and what that means. Name every provider.
   - Para 3: GPU compute market. Supply/demand dynamics. Price movements. Availability constraints. What's tightening, what's loosening.
   - Para 4: Margin analysis. Where is inference profitable vs unprofitable? At which tiers? On which hardware? Be specific with numbers.
   - Para 5: Provider-by-provider assessment. Grade each major provider (OpenAI, Anthropic, Google, DeepSeek, Meta, xAI) on pricing strategy — who has pricing power, who's burning cash, who's positioned well.
   - Para 6: Bottom line. What would a portfolio manager do with this data today? Be concrete.
2. After the paragraphs, list 8-10 bullet points — each a specific quantitative finding from the data. Lead each with the metric.

Rules:
- Be ruthlessly data-driven. Every claim needs a number from the data provided.
- Be unbiased. Criticize Anthropic, OpenAI, Google equally. No sacred cows.
- Compare token sell prices to GPU production costs. If sell < cost, name the subsidy and estimate the monthly burn.
- Calculate implied margins for each major provider's flagship model on the cheapest available GPU.
- If GPU availability is below 25%, call it a supply constraint. Above 60%, oversupply.
- Note day-over-day price changes and what they signal.
- Do NOT use markdown. Plain text only. No headers, bold, or bullet dashes.
- Bullet points are plain sentences starting with the key number.

Format your response as JSON:
{"paragraphs": ["paragraph 1", "paragraph 2", ...], "bullets": ["bullet 1", "bullet 2", ...]}`
    }],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "";

  try {
    // Try to parse JSON directly
    const parsed = JSON.parse(text);
    return parsed;
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Fall back to treating the whole thing as a single paragraph
    return { paragraphs: [text], bullets: [] };
  }
}

function generateRuleBased(dataContext: string): { paragraphs: string[]; bullets: string[] } {
  // Fallback rule-based generator (same as before)
  const tokenData = readJSON<{ models: TokenModel[] }>(dataPath("token-pricing", "current.json"));
  const gpuData = readJSON<{ summaries: GPUSummary[] }>(dataPath("gpu-pricing", "current.json"));
  const llmflation = readJSON<{ currentIndex: number }>(dataPath("indices", "llmflation.json"));

  const models = tokenData?.models || [];
  const gpus = (gpuData?.summaries || []).filter(g => g.spot.median);
  const paragraphs: string[] = [];
  const bullets: string[] = [];

  if (llmflation) {
    paragraphs.push(`The BEP LLMflation Index sits at ${llmflation.currentIndex.toFixed(1)}, down ${(100 - llmflation.currentIndex).toFixed(0)}% from the GPT-4 launch baseline. Frontier inference continues to deflate — but unevenly. Premium holds pricing power while the commodity floor races toward zero.`);
  }

  if (models.length > 0) {
    const sorted = [...models].sort((a, b) => b.outputPerMillion - a.outputPerMillion);
    const spread = Math.round(sorted[0].outputPerMillion / sorted[sorted.length - 1].outputPerMillion);
    paragraphs.push(`${models.length} models tracked. ${spread}x spread between cheapest and premium. This is bifurcation, not commoditization.`);
  }

  for (const gpu of gpus) {
    const name = gpu.gpuModel.replace("nvidia-", "").toUpperCase();
    bullets.push(`${name}: $${gpu.spot.median?.toFixed(2)}/hr spot, ${gpu.availabilityPct}% available (${gpu.totalGpusAvailable}/${gpu.totalGpusAvailable + gpu.totalGpusRented})`);
  }

  paragraphs.push(`Bottom line: Track the spread between commodity and premium inference. The hardware generation determines profitability. Capital follows the margin.`);

  return { paragraphs, bullets };
}

async function main() {
  console.log("Generating market commentary...");
  const dataContext = buildDataContext();

  let result: { paragraphs: string[]; bullets: string[] };
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    console.log("Using Claude API for commentary...");
    try {
      result = await generateWithClaude(dataContext);
      console.log(`Claude generated: ${result.paragraphs.length} paragraphs, ${result.bullets.length} bullets`);
    } catch (err) {
      console.error("Claude API failed, falling back to rule-based:", err);
      result = generateRuleBased(dataContext);
    }
  } else {
    console.log("No ANTHROPIC_API_KEY — using rule-based commentary.");
    result = generateRuleBased(dataContext);
  }

  const tokenData = readJSON<{ models: TokenModel[] }>(dataPath("token-pricing", "current.json"));
  const gpuData = readJSON<{ summaries: GPUSummary[] }>(dataPath("gpu-pricing", "current.json"));
  const llmflation = readJSON<{ currentIndex: number }>(dataPath("indices", "llmflation.json"));

  const commentary = {
    generatedAt: nowISO(),
    date: todayISO(),
    title: `Market Brief — ${new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}`,
    poweredBy: apiKey ? "Claude Opus 4.6" : "BEP Research rule engine",
    summary: result.paragraphs[0] || "",
    paragraphs: result.paragraphs,
    bullets: result.bullets,
    dataPoints: {
      modelsTracked: tokenData?.models.length || 0,
      gpuMarketsTracked: (gpuData?.summaries || []).filter(g => g.spot.median).length,
      llmflationIndex: llmflation?.currentIndex || null,
      gpuOffers: (gpuData?.summaries || []).reduce((s, g) => s + (g.spot.count || 0), 0),
    },
  };

  writeJSON(dataPath("commentary", "latest.json"), commentary);
  console.log("Done.");
}

main().catch(console.error);
