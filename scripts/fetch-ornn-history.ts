import { dataPath, writeJSON, nowISO, todayISO } from "./utils";

const ORNN_API = "https://data.ornnai.com";
const TOKEN = process.env.ORNN_AI_TOKEN;

// 6 months back for charts
const SIX_MONTHS_AGO = new Date(Date.now() - 180 * 86400000).toISOString().split("T")[0];

const GPU_MODELS = [
  { ornn: "H100 SXM", key: "h100" },
  { ornn: "H200", key: "h200" },
  { ornn: "B200", key: "b200" },
  { ornn: "A100 SXM4", key: "a100" },
];

const MEMORY_TYPES = [
  { ornn: "DDR5 RDIMM 32GB 4800/5600", key: "ddr5-rdimm-32gb", label: "DDR5 RDIMM 32GB" },
  { ornn: "DDR5 16Gb (2Gx8) 4800/5600", key: "ddr5-16gb-chip", label: "DDR5 16Gb Chip" },
  { ornn: "DDR5 16Gb (2Gx8) eTT", key: "ddr5-16gb-ett", label: "DDR5 16Gb eTT" },
];

async function ornnFetch(path: string): Promise<unknown | null> {
  if (!TOKEN) return null;
  try {
    const res = await fetch(`${ORNN_API}${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (!res.ok) {
      console.error(`  [Ornn] ${path}: HTTP ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error(`  [Ornn] ${path}: Error`, err);
    return null;
  }
}

// ── GPU Utilization History (6 months) ──
async function fetchGPUUtilizationHistory() {
  console.log("\n=== Fetching GPU Utilization History (6 months) ===");
  const today = todayISO();
  const result: Record<string, Array<{ date: string; utilization: number }>> = {};

  for (const gpu of GPU_MODELS) {
    const data = await ornnFetch(
      `/api/gpu/${encodeURIComponent(gpu.ornn)}/volume-metrics?startDate=${SIX_MONTHS_AGO}&endDate=${today}&limit=1000`
    ) as { success: boolean; data: Array<{ recorded_at: string; utilization_ratio: number }> } | null;

    if (data?.success && data.data.length > 0) {
      // Reverse so oldest first (chart order)
      result[gpu.key] = data.data.reverse().map(d => ({
        date: d.recorded_at.split("T")[0],
        utilization: Math.round(d.utilization_ratio * 1000) / 10, // e.g. 89.8%
      }));
      console.log(`  ${gpu.ornn}: ${result[gpu.key].length} days (${result[gpu.key][0].date} → ${result[gpu.key][result[gpu.key].length - 1].date})`);
    } else {
      console.log(`  ${gpu.ornn}: no data`);
    }
  }

  writeJSON(dataPath("ornn", "gpu-utilization-history.json"), {
    fetchedAt: nowISO(),
    startDate: SIX_MONTHS_AGO,
    endDate: today,
    gpus: result,
  });
}

// ── OCPI Price Index + Volatility ──
async function fetchOCPIPrices() {
  console.log("\n=== Fetching OCPI Price Index + Volatility ===");
  const today = todayISO();
  const result: Record<string, Array<{ date: string; price: number; volatility: number }>> = {};
  const latest: Record<string, { price: number; volatility: number }> = {};

  for (const gpu of GPU_MODELS) {
    const data = await ornnFetch(
      `/api/gpu/${encodeURIComponent(gpu.ornn)}/volatility?startDate=${SIX_MONTHS_AGO}&endDate=${today}&windowDays=30`
    ) as { success: boolean; data: Array<{ recorded_at: string; index_value: number; rolling_volatility: number }> } | null;

    if (data?.success && data.data.length > 0) {
      // Reverse so oldest first
      result[gpu.key] = data.data.reverse().map(d => ({
        date: d.recorded_at.split("T")[0],
        price: Math.round(d.index_value * 100) / 100,
        volatility: Math.round(d.rolling_volatility * 1000) / 10, // e.g. 20.7%
      }));
      const last = data.data[data.data.length - 1];
      latest[gpu.key] = {
        price: Math.round(last.index_value * 100) / 100,
        volatility: Math.round(last.rolling_volatility * 1000) / 10,
      };
      console.log(`  ${gpu.ornn}: $${latest[gpu.key].price}/hr, ${latest[gpu.key].volatility}% vol (${result[gpu.key].length} days)`);
    } else {
      console.log(`  ${gpu.ornn}: no data`);
    }
  }

  writeJSON(dataPath("ornn", "ocpi-prices.json"), {
    fetchedAt: nowISO(),
    startDate: SIX_MONTHS_AGO,
    endDate: today,
    latest,
    history: result,
  });
}

// ── Memory Spot Pricing ──
async function fetchMemoryPricing() {
  console.log("\n=== Fetching Memory Spot Pricing ===");

  // Current index
  const index = await ornnFetch("/api/memory-index") as {
    success: boolean;
    date: string;
    data: Array<{
      memoryType: string; category: string; price: number;
      changePct: number; weeklyHigh: number; weeklyLow: number;
    }>;
  } | null;

  const current: Array<{
    key: string; label: string; category: string;
    price: number; changePct: number; weeklyHigh: number; weeklyLow: number;
  }> = [];

  if (index?.success) {
    for (const mt of MEMORY_TYPES) {
      const found = index.data.find(d => d.memoryType === mt.ornn);
      if (found) {
        current.push({
          key: mt.key,
          label: mt.label,
          category: found.category,
          price: found.price,
          changePct: found.changePct,
          weeklyHigh: found.weeklyHigh,
          weeklyLow: found.weeklyLow,
        });
        console.log(`  ${mt.label}: $${found.price} (${found.changePct > 0 ? "+" : ""}${found.changePct}% WoW, range $${found.weeklyLow}-$${found.weeklyHigh})`);
      }
    }
  }

  // Historical for key types
  const today = todayISO();
  const history: Record<string, Array<{ date: string; price: number }>> = {};

  for (const mt of MEMORY_TYPES) {
    const data = await ornnFetch(
      `/api/memory/${encodeURIComponent(mt.ornn)}/history?startDate=2025-06-01&endDate=${today}&limit=1000`
    ) as { success: boolean; data: Array<{ date: string; price: number }> } | null;

    if (data?.success && data.data.length > 0) {
      // Deduplicate by date (take first occurrence), keep chronological
      const seen = new Set<string>();
      history[mt.key] = data.data
        .map(d => ({ date: d.date.split("T")[0], price: d.price }))
        .filter(d => {
          if (seen.has(d.date)) return false;
          seen.add(d.date);
          return true;
        });
      console.log(`  ${mt.label} history: ${history[mt.key].length} days`);
    }
  }

  writeJSON(dataPath("ornn", "memory-pricing.json"), {
    fetchedAt: nowISO(),
    date: index?.date || nowISO(),
    current,
    history,
  });
}

async function main() {
  if (!TOKEN) {
    console.error("ORNN_AI_TOKEN not set. Skipping Ornn history fetch.");
    return;
  }

  await fetchGPUUtilizationHistory();
  await fetchOCPIPrices();
  await fetchMemoryPricing();

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
