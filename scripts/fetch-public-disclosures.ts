/**
 * Pulls each public platform's most-recently-reported quarterly revenue from
 * the SEC EDGAR XBRL companyfacts API and writes the snapshots into a SEPARATE
 * file (data/static/platform-disclosures.json) so the hand-edited
 * token-waterfall.json is never reformatted by the cron.
 *
 * Reads:  data/static/platform-registry.json — small, stable ticker/CIK map.
 * Writes: data/static/platform-disclosures.json — { snapshots: { platformId: { latestQuarter: {...} } } }.
 *
 * SEC EDGAR requires a descriptive User-Agent identifying the requester
 * (https://www.sec.gov/os/accessing-edgar-data). Set SEC_USER_AGENT in the
 * workflow env to control it.
 */
import { readFileSync } from "fs";
import { dataPath, writeJSON, todayISO, nowISO } from "./utils";

const UA = process.env.SEC_USER_AGENT ?? "BEP Research bot@bepresearch.com";

// XBRL concepts ranked by likely fit for SaaS top-line revenue. The first concept
// that returns USD quarterly data wins. Different companies report under different
// taxonomy tags depending on their accounting choices.
const USGAAP_REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "SalesRevenueNet",
] as const;

const IFRS_REVENUE_CONCEPTS = [
  "Revenue",
  "RevenueFromContractsWithCustomers",
] as const;

interface XbrlUnitEntry {
  end: string;       // period end YYYY-MM-DD
  start?: string;    // period start YYYY-MM-DD (for duration-based facts)
  val: number;
  fy: number;
  fp: string;        // Q1/Q2/Q3/Q4/FY
  form: string;      // 10-Q, 10-K, 20-F
  filed: string;     // filing date
  frame?: string;
}

interface CompanyFacts {
  facts?: {
    "us-gaap"?: Record<string, { units?: Record<string, XbrlUnitEntry[]> }>;
    "ifrs-full"?: Record<string, { units?: Record<string, XbrlUnitEntry[]> }>;
  };
}

interface QuarterSnapshot {
  period: string;        // human-readable: "Q3 FY26" or "Q1 2026"
  periodEnd: string;     // ISO date
  revenue: number;       // in `currency` units
  currency: string;      // "USD", "EUR", etc.
  revenueYoY: number | null;
  filedAt: string;
  form: string;
  concept: string;
  taxonomy: string;
  source: "SEC XBRL";
  sourceUrl: string;
  fetchedAt: string;
}

interface RegistryPlatform {
  ticker: string | null;
  secCik: string | null;
  lastVerifiedAt: string;
  privateCompany?: boolean;
  foreignPrivateIssuer?: boolean;
}

interface Registry {
  platforms: Record<string, RegistryPlatform>;
}

interface DisclosuresFile {
  source: string;
  lastUpdated: string | null;
  snapshots: Record<string, { latestQuarter: QuarterSnapshot } | { error: string; fetchedAt: string }>;
}

async function fetchCompanyFacts(cik: string): Promise<CompanyFacts | null> {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept": "application/json" },
    });
    if (!res.ok) {
      console.warn(`  ! ${url} -> HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as CompanyFacts;
  } catch (err) {
    console.warn(`  ! ${url} -> ${(err as Error).message}`);
    return null;
  }
}

/** Quarterly facts have ~88-95 day windows. Allow a small slop. */
function isQuarterly(entry: XbrlUnitEntry): boolean {
  if (!entry.start || !entry.end) return false;
  const days = (new Date(entry.end).getTime() - new Date(entry.start).getTime()) / (1000 * 60 * 60 * 24);
  return days >= 80 && days <= 100;
}

function findLatestQuarterly(
  facts: CompanyFacts,
  preferEUR: boolean,
): { entry: XbrlUnitEntry; concept: string; taxonomy: "us-gaap" | "ifrs-full"; currency: string } | null {
  const taxOrder: Array<["us-gaap" | "ifrs-full", readonly string[]]> = preferEUR
    ? [["ifrs-full", IFRS_REVENUE_CONCEPTS], ["us-gaap", USGAAP_REVENUE_CONCEPTS]]
    : [["us-gaap", USGAAP_REVENUE_CONCEPTS], ["ifrs-full", IFRS_REVENUE_CONCEPTS]];
  const currencyOrder = preferEUR ? ["EUR", "USD"] : ["USD", "EUR"];

  for (const [taxonomy, concepts] of taxOrder) {
    const tax = facts.facts?.[taxonomy];
    if (!tax) continue;
    for (const concept of concepts) {
      const units = tax[concept]?.units;
      if (!units) continue;
      for (const ccy of currencyOrder) {
        const entries = units[ccy];
        if (!entries?.length) continue;
        const quarterlies = entries.filter(isQuarterly);
        if (!quarterlies.length) continue;
        quarterlies.sort((a, b) => {
          if (b.filed !== a.filed) return b.filed.localeCompare(a.filed);
          return b.end.localeCompare(a.end);
        });
        return { entry: quarterlies[0], concept, taxonomy, currency: ccy };
      }
    }
  }
  return null;
}

function findYoYComparable(
  facts: CompanyFacts,
  taxonomy: "us-gaap" | "ifrs-full",
  concept: string,
  currency: string,
  reference: XbrlUnitEntry,
): XbrlUnitEntry | null {
  const entries = facts.facts?.[taxonomy]?.[concept]?.units?.[currency] ?? [];
  const refEndMs = new Date(reference.end).getTime();
  const candidates = entries.filter(isQuarterly).filter((e) => {
    const days = (refEndMs - new Date(e.end).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 350 && days <= 380;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.filed.localeCompare(a.filed));
  return candidates[0];
}

function periodLabel(entry: XbrlUnitEntry): string {
  if (entry.fp && entry.fy && entry.fp !== "FY") {
    return `${entry.fp} FY${String(entry.fy).slice(-2)}`;
  }
  const d = new Date(entry.end);
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `Q${q} ${d.getUTCFullYear()}`;
}

async function fetchSnapshot(cik: string, preferEUR: boolean): Promise<QuarterSnapshot | null> {
  const facts = await fetchCompanyFacts(cik);
  if (!facts) return null;
  const found = findLatestQuarterly(facts, preferEUR);
  if (!found) {
    console.warn(`  ! no quarterly revenue concept found for CIK ${cik}`);
    return null;
  }
  const yoy = findYoYComparable(facts, found.taxonomy, found.concept, found.currency, found.entry);
  const revenueYoY = yoy && yoy.val > 0
    ? (found.entry.val - yoy.val) / yoy.val
    : null;
  return {
    period: periodLabel(found.entry),
    periodEnd: found.entry.end,
    revenue: found.entry.val,
    currency: found.currency,
    revenueYoY,
    filedAt: found.entry.filed,
    form: found.entry.form,
    concept: found.concept,
    taxonomy: found.taxonomy,
    source: "SEC XBRL",
    sourceUrl: `https://data.sec.gov/api/xbrl/companyconcept/CIK${cik}/${found.taxonomy}/${found.concept}.json`,
    fetchedAt: nowISO(),
  };
}

async function main() {
  const registryPath = dataPath("static/platform-registry.json");
  const disclosuresPath = dataPath("static/platform-disclosures.json");
  const registry: Registry = JSON.parse(readFileSync(registryPath, "utf-8"));
  const existing: DisclosuresFile = JSON.parse(readFileSync(disclosuresPath, "utf-8"));

  const newSnapshots: DisclosuresFile["snapshots"] = { ...existing.snapshots };
  const cache = new Map<string, QuarterSnapshot | null>();
  let success = 0;
  let failed = 0;

  for (const [platformId, meta] of Object.entries(registry.platforms)) {
    if (!meta.secCik) continue;
    const cacheKey = `${meta.secCik}|${meta.foreignPrivateIssuer ? "EUR" : "USD"}`;
    if (!cache.has(cacheKey)) {
      console.log(`Fetching ${platformId} (${meta.ticker}, CIK ${meta.secCik})${meta.foreignPrivateIssuer ? " [EUR preferred]" : ""}…`);
      cache.set(cacheKey, await fetchSnapshot(meta.secCik, Boolean(meta.foreignPrivateIssuer)));
      await new Promise((r) => setTimeout(r, 150)); // SEC asks for <10 req/sec
    }
    const snapshot = cache.get(cacheKey);
    if (snapshot) {
      newSnapshots[platformId] = { latestQuarter: snapshot };
      success += 1;
      const yoyStr = snapshot.revenueYoY === null ? "n/a" : `${(snapshot.revenueYoY * 100).toFixed(1)}%`;
      console.log(`  ${platformId} ${snapshot.period}: ${snapshot.currency} ${(snapshot.revenue / 1e9).toFixed(2)}B, YoY ${yoyStr}`);
    } else {
      // Preserve the previous snapshot if we had one. Record an error stamp
      // alongside it so the UI can show "last fetched X, last successful Y".
      if (!newSnapshots[platformId]) {
        newSnapshots[platformId] = { error: "Initial fetch failed — no XBRL data returned.", fetchedAt: nowISO() };
      }
      failed += 1;
    }
  }

  const output: DisclosuresFile = {
    source: existing.source,
    lastUpdated: todayISO(),
    snapshots: newSnapshots,
  };
  writeJSON(disclosuresPath, output);
  console.log(`\nDone. ${success} fetched, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
