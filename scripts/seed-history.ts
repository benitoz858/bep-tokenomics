// Seed synthetic historical GPU pricing data for chart development
// Based on real market trends. Remove once 30+ days of real data accumulates.

import { dataPath, writeJSON, readJSON } from "./utils";

interface GPUSummary {
  gpuModel: string;
  onDemand: { min: number | null; median: number | null; max: number | null; count: number };
  spot: { min: number | null; median: number | null; max: number | null; count: number };
  availabilityPct: number;
  offeringCount: number;
  totalGpusAvailable: number;
  totalGpusRented: number;
  avgReliability: number;
  regions: Record<string, number>;
}

// Realistic trend data based on market dynamics
// H100: commoditizing, price falling, availability improving
// H200: still scarce, price stable-to-falling
// B200: new, very scarce, price high but starting to come down
function generateDay(date: string, dayOffset: number): GPUSummary[] {
  const noise = () => (Math.random() - 0.5) * 0.15; // ±7.5% daily noise
  const t = dayOffset / 60; // 0 to 1 over 60 days

  return [
    {
      gpuModel: "nvidia-h100",
      onDemand: { min: null, median: null, max: null, count: 0 },
      spot: {
        min: 0.85 + noise() * 0.3,
        median: Math.max(0.8, 2.10 - t * 0.6 + noise() * 0.4), // falling from ~$2.10 to ~$1.50
        max: 2.50 - t * 0.5 + noise() * 0.3,
        count: Math.round(15 + t * 10 + Math.random() * 5),
      },
      availabilityPct: Math.min(95, Math.max(5, Math.round(10 + t * 15 + (Math.random() - 0.5) * 20))), // rising from ~10% to ~25%
      offeringCount: Math.round(15 + t * 10),
      totalGpusAvailable: Math.round(30 + t * 30 + Math.random() * 20),
      totalGpusRented: Math.round(200 + Math.random() * 30),
      avgReliability: 98 + Math.random() * 2,
      regions: { US: 100, FR: 40, NL: 20 },
    },
    {
      gpuModel: "nvidia-h200",
      onDemand: { min: null, median: null, max: null, count: 0 },
      spot: {
        min: 1.80 + noise() * 0.3,
        median: Math.max(1.5, 3.20 - t * 0.9 + noise() * 0.5), // falling from ~$3.20 to ~$2.30
        max: 4.00 - t * 1.0 + noise() * 0.4,
        count: Math.round(10 + t * 20 + Math.random() * 5),
      },
      availabilityPct: Math.min(95, Math.max(5, Math.round(15 + t * 20 + (Math.random() - 0.5) * 25))), // rising from ~15% to ~35%
      offeringCount: Math.round(10 + t * 20),
      totalGpusAvailable: Math.round(60 + t * 80 + Math.random() * 30),
      totalGpusRented: Math.round(250 + Math.random() * 40),
      avgReliability: 97 + Math.random() * 3,
      regions: { US: 130, JP: 80, FR: 60 },
    },
    {
      gpuModel: "nvidia-b200",
      onDemand: { min: null, median: null, max: null, count: 0 },
      spot: {
        min: 2.50 + noise() * 0.5,
        median: Math.max(3.0, 12.00 - t * 4.5 + noise() * 1.5), // falling from ~$12 to ~$7.50
        max: 14.00 - t * 5.0 + noise() * 1.0,
        count: Math.round(5 + t * 18 + Math.random() * 5),
      },
      availabilityPct: Math.min(80, Math.max(2, Math.round(5 + t * 22 + (Math.random() - 0.5) * 15))), // rising from ~5% to ~27%
      offeringCount: Math.round(5 + t * 18),
      totalGpusAvailable: Math.round(15 + t * 75 + Math.random() * 20),
      totalGpusRented: Math.round(200 + t * 60 + Math.random() * 30),
      avgReliability: 93 + Math.random() * 5,
      regions: { US: 250, GB: 20, NL: 10 },
    },
  ];
}

function main() {
  const historyPath = dataPath("gpu-pricing", "history.json");
  const existing = readJSON<{ lastUpdated: string; entries: Record<string, GPUSummary[]> }>(historyPath) || { lastUpdated: "", entries: {} };

  // Generate 60 days of synthetic data leading up to today
  const today = new Date();
  const entries: Record<string, GPUSummary[]> = {};

  for (let i = 60; i >= 1; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];

    // Don't overwrite real data
    if (existing.entries[dateStr]) {
      entries[dateStr] = existing.entries[dateStr];
    } else {
      entries[dateStr] = generateDay(dateStr, 60 - i);
    }
  }

  // Keep today's real data
  for (const [date, data] of Object.entries(existing.entries)) {
    entries[date] = data;
  }

  writeJSON(historyPath, {
    lastUpdated: today.toISOString().split("T")[0],
    entries,
  });

  console.log(`Seeded ${Object.keys(entries).length} days of history (${60} synthetic + real data preserved).`);
  console.log("NOTE: Remove synthetic data once 30+ days of real data accumulates.");
}

main();
