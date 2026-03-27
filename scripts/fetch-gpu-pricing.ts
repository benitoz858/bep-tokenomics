import { dataPath, writeJSON, readJSON, todayISO, nowISO } from "./utils";

// ── GetDeploying API ──
const GETDEPLOYING_API = "https://getdeploying.com/api/gpu-offerings";

// ── Vast.ai API ──
const VASTAI_API = "https://console.vast.ai/api/v0/bundles/";

const TRACKED_GPUS = [
  "nvidia-a100", "nvidia-h100", "nvidia-h200",
  "nvidia-b200", "nvidia-gb200",
  "amd-mi300x", "amd-mi355x",
];

const GPU_NAME_MAP: Record<string, string> = {
  "a100": "nvidia-a100",
  "a100-sxm": "nvidia-a100",
  "a100-pcie": "nvidia-a100",
  "h100": "nvidia-h100",
  "h100-sxm": "nvidia-h100",
  "h100-pcie": "nvidia-h100",
  "h200": "nvidia-h200",
  "h200-sxm": "nvidia-h200",
  "b200": "nvidia-b200",
  "gb200": "nvidia-gb200",
  "mi300x": "amd-mi300x",
  "mi355x": "amd-mi355x",
};

interface GPUOffering {
  provider: string;
  gpuModel: string;
  gpuCount: number;
  hourlyPerGpu: number;
  billingType: "ON_DEMAND" | "SPOT" | "RESERVED";
  availability: "AVAILABLE" | "OUT_OF_STOCK";
  vramPerGpuGb: number;
  lastVerified: string;
  reliability?: number;
  geolocation?: string;
  rented?: boolean;
  totalFlops?: number;
}

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

function normalizeGpuName(raw: string): string | null {
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, "");
  for (const [pattern, normalized] of Object.entries(GPU_NAME_MAP)) {
    if (key.includes(pattern.replace(/-/g, ""))) return normalized;
  }
  for (const tracked of TRACKED_GPUS) {
    if (key.includes(tracked.replace("nvidia-", "").replace("amd-", ""))) return tracked;
  }
  return null;
}

function median(arr: number[]): number | null {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStats(prices: number[]): { min: number | null; median: number | null; max: number | null; count: number } {
  if (!prices.length) return { min: null, median: null, max: null, count: 0 };
  return {
    min: Math.min(...prices),
    median: median(prices),
    max: Math.max(...prices),
    count: prices.length,
  };
}

async function fetchGetDeploying(): Promise<GPUOffering[]> {
  const apiKey = process.env.GETDEPLOYING_API_KEY;
  if (!apiKey) {
    console.log("[GetDeploying] No API key — skipping. Set GETDEPLOYING_API_KEY.");
    return [];
  }

  console.log("Fetching GetDeploying GPU offerings...");
  const res = await fetch(GETDEPLOYING_API, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    console.error(`[GetDeploying] API error: ${res.status}`);
    return [];
  }

  const data = await res.json() as Array<{
    provider?: string;
    gpu_model?: string;
    gpu_count?: number;
    hourly_per_gpu?: number;
    billing_type?: string;
    availability?: string;
    vram_per_gpu_gb?: number;
    last_verified?: string;
  }>;
  console.log(`[GetDeploying] Got ${data.length} offerings`);

  const offerings: GPUOffering[] = [];
  for (const item of data) {
    const gpu = normalizeGpuName(item.gpu_model || "");
    if (!gpu) continue;

    offerings.push({
      provider: item.provider || "unknown",
      gpuModel: gpu,
      gpuCount: item.gpu_count || 1,
      hourlyPerGpu: item.hourly_per_gpu || 0,
      billingType: (item.billing_type as GPUOffering["billingType"]) || "ON_DEMAND",
      availability: (item.availability as GPUOffering["availability"]) || "AVAILABLE",
      vramPerGpuGb: item.vram_per_gpu_gb || 0,
      lastVerified: item.last_verified || nowISO(),
    });
  }

  return offerings;
}

async function fetchVastAI(): Promise<GPUOffering[]> {
  const apiKey = process.env.VASTAI_API_KEY;
  if (!apiKey) {
    console.log("[Vast.ai] No API key — skipping. Set VASTAI_API_KEY.");
    return [];
  }

  console.log("Fetching Vast.ai spot pricing...");
  const offerings: GPUOffering[] = [];

  const gpuQueries = ["H100 SXM", "H200", "A100 SXM", "A100", "B200"];
  for (const gpuName of gpuQueries) {
    try {
      // Fetch rentable (available) offers
      const qAvail = JSON.stringify({ gpu_name: gpuName, num_gpus: { gte: 1 }, rentable: { eq: true } });
      const urlAvail = `${VASTAI_API}?q=${encodeURIComponent(qAvail)}&limit=100`;
      const resAvail = await fetch(urlAvail, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      // Fetch rented (unavailable) offers for true availability %
      const qRented = JSON.stringify({ gpu_name: gpuName, num_gpus: { gte: 1 }, rented: { eq: true } });
      const urlRented = `${VASTAI_API}?q=${encodeURIComponent(qRented)}&limit=100`;
      const resRented = await fetch(urlRented, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!resAvail.ok) continue;

      interface VastOffer {
        dph_total?: number;
        num_gpus?: number;
        gpu_ram?: number;
        machine_id?: number;
        reliability?: number;
        reliability2?: number;
        geolocation?: string;
        rented?: boolean;
        total_flops?: number;
      }

      const availData = await resAvail.json() as { offers?: VastOffer[] };
      const rentedData = resRented.ok ? await resRented.json() as { offers?: VastOffer[] } : { offers: [] };
      const availOffers = availData.offers || [];
      const rentedOffers = rentedData.offers || [];

      for (const offer of availOffers) {
        const normalized = normalizeGpuName(gpuName);
        if (!normalized) continue;

        const totalPerHour = offer.dph_total || 0;
        const numGpus = offer.num_gpus || 1;

        offerings.push({
          provider: "vast-ai",
          gpuModel: normalized,
          gpuCount: numGpus,
          hourlyPerGpu: totalPerHour / numGpus,
          billingType: "SPOT",
          availability: "AVAILABLE",
          vramPerGpuGb: (offer.gpu_ram || 0) / 1024,
          lastVerified: nowISO(),
          reliability: offer.reliability2 || offer.reliability || 0,
          geolocation: offer.geolocation || "Unknown",
          rented: false,
          totalFlops: offer.total_flops || 0,
        });
      }

      // Add rented offers as OUT_OF_STOCK for availability tracking
      for (const offer of rentedOffers) {
        const normalized = normalizeGpuName(gpuName);
        if (!normalized) continue;

        const totalPerHour = offer.dph_total || 0;
        const numGpus = offer.num_gpus || 1;

        offerings.push({
          provider: "vast-ai",
          gpuModel: normalized,
          gpuCount: numGpus,
          hourlyPerGpu: totalPerHour / numGpus,
          billingType: "SPOT",
          availability: "OUT_OF_STOCK",
          vramPerGpuGb: (offer.gpu_ram || 0) / 1024,
          lastVerified: nowISO(),
          reliability: offer.reliability2 || offer.reliability || 0,
          geolocation: offer.geolocation || "Unknown",
          rented: true,
          totalFlops: offer.total_flops || 0,
        });
      }

      const totalGpus = availOffers.reduce((s, o) => s + (o.num_gpus || 1), 0)
        + rentedOffers.reduce((s, o) => s + (o.num_gpus || 1), 0);
      const rentedGpus = rentedOffers.reduce((s, o) => s + (o.num_gpus || 1), 0);
      console.log(`  [Vast.ai] ${gpuName}: ${availOffers.length} available, ${rentedOffers.length} rented (${totalGpus} total GPUs, ${totalGpus > 0 ? Math.round((1 - rentedGpus / totalGpus) * 100) : 0}% free)`);
    } catch (err) {
      console.error(`  [Vast.ai] Error fetching ${gpuName}:`, err);
    }
  }

  return offerings;
}

function summarize(offerings: GPUOffering[]): GPUSummary[] {
  const byGpu = new Map<string, GPUOffering[]>();
  for (const o of offerings) {
    const arr = byGpu.get(o.gpuModel) || [];
    arr.push(o);
    byGpu.set(o.gpuModel, arr);
  }

  const summaries: GPUSummary[] = [];
  for (const gpuModel of TRACKED_GPUS) {
    const all = byGpu.get(gpuModel) || [];
    if (!all.length) continue;

    const onDemandPrices = all.filter((o) => o.billingType === "ON_DEMAND" && o.hourlyPerGpu > 0 && o.availability === "AVAILABLE").map((o) => o.hourlyPerGpu);
    const spotPrices = all.filter((o) => o.billingType === "SPOT" && o.hourlyPerGpu > 0 && o.availability === "AVAILABLE").map((o) => o.hourlyPerGpu);

    const totalGpusAvailable = all.filter((o) => o.availability === "AVAILABLE").reduce((s, o) => s + o.gpuCount, 0);
    const totalGpusRented = all.filter((o) => o.availability === "OUT_OF_STOCK").reduce((s, o) => s + o.gpuCount, 0);
    const totalGpus = totalGpusAvailable + totalGpusRented;

    const reliabilities = all.filter((o) => o.reliability && o.reliability > 0).map((o) => o.reliability!);
    const avgReliability = reliabilities.length ? Math.round((reliabilities.reduce((a, b) => a + b, 0) / reliabilities.length) * 10000) / 100 : 0;

    const regions: Record<string, number> = {};
    for (const o of all) {
      if (o.geolocation) {
        const region = o.geolocation.split(",")[1]?.trim() || o.geolocation;
        regions[region] = (regions[region] || 0) + o.gpuCount;
      }
    }

    summaries.push({
      gpuModel,
      onDemand: computeStats(onDemandPrices),
      spot: computeStats(spotPrices),
      availabilityPct: totalGpus > 0 ? Math.round((totalGpusAvailable / totalGpus) * 100) : 0,
      offeringCount: all.filter((o) => o.availability === "AVAILABLE").length,
      totalGpusAvailable,
      totalGpusRented,
      avgReliability,
      regions,
    });
  }

  return summaries;
}

async function main() {
  const [getDeployingData, vastData] = await Promise.all([
    fetchGetDeploying(),
    fetchVastAI(),
  ]);

  const allOfferings = [...getDeployingData, ...vastData];
  console.log(`\nTotal offerings: ${allOfferings.length}`);

  if (allOfferings.length === 0) {
    console.log("No GPU data fetched — writing fallback with manual estimates.");
    // Write fallback data based on known market rates
    const fallback = {
      fetchedAt: nowISO(),
      source: "BEP Research manual estimates (no API keys configured)",
      offeringCount: 0,
      summaries: [
        { gpuModel: "nvidia-a100", onDemand: { min: 1.10, median: 1.50, max: 2.20, count: 0 }, spot: { min: 0.70, median: 0.90, max: 1.30, count: 0 }, availabilityPct: 85, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
        { gpuModel: "nvidia-h100", onDemand: { min: 2.00, median: 2.69, max: 3.50, count: 0 }, spot: { min: 1.50, median: 2.00, max: 2.80, count: 0 }, availabilityPct: 70, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
        { gpuModel: "nvidia-h200", onDemand: { min: 3.20, median: 3.80, max: 4.50, count: 0 }, spot: { min: 2.40, median: 3.00, max: 3.80, count: 0 }, availabilityPct: 45, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
        { gpuModel: "nvidia-b200", onDemand: { min: 4.50, median: 5.50, max: 7.00, count: 0 }, spot: { min: 3.50, median: 4.20, max: 5.50, count: 0 }, availabilityPct: 25, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
        { gpuModel: "nvidia-gb200", onDemand: { min: 8.00, median: 10.00, max: 14.00, count: 0 }, spot: { min: null, median: null, max: null, count: 0 }, availabilityPct: 10, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
        { gpuModel: "amd-mi300x", onDemand: { min: 1.80, median: 2.40, max: 3.20, count: 0 }, spot: { min: 1.20, median: 1.60, max: 2.20, count: 0 }, availabilityPct: 60, offeringCount: 0, totalGpusAvailable: 0, totalGpusRented: 0, avgReliability: 0, regions: {} },
      ],
      offerings: [],
    };
    writeJSON(dataPath("gpu-pricing", "current.json"), fallback);

    // Still append to history
    const historyPath = dataPath("gpu-pricing", "history.json");
    const history = readJSON<{ entries: Record<string, unknown> }>(historyPath) || { entries: {} };
    history.entries[todayISO()] = fallback.summaries;
    writeJSON(historyPath, { lastUpdated: todayISO(), entries: history.entries });

    return;
  }

  const summaries = summarize(allOfferings);

  // Write current snapshot
  writeJSON(dataPath("gpu-pricing", "current.json"), {
    fetchedAt: nowISO(),
    source: "GetDeploying + Vast.ai",
    offeringCount: allOfferings.length,
    summaries,
    offerings: allOfferings,
  });

  // Append to history
  const historyPath = dataPath("gpu-pricing", "history.json");
  const history = readJSON<{ entries: Record<string, unknown> }>(historyPath) || { entries: {} };
  history.entries[todayISO()] = summaries;
  writeJSON(historyPath, { lastUpdated: todayISO(), entries: history.entries });

  console.log(`\nDone. ${summaries.length} GPU models summarized.`);
  for (const s of summaries) {
    console.log(`  ${s.gpuModel}: on-demand median $${s.onDemand.median?.toFixed(2) || "N/A"}/hr, spot median $${s.spot.median?.toFixed(2) || "N/A"}/hr, ${s.availabilityPct}% available`);
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
