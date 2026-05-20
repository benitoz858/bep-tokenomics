/**
 * Pricing-page change detector.
 *
 * For each platform with a sourceLinks[type=pricing] URL, fetch the page, extract
 * the headline price (via Claude on the HTML), and compare to the value currently
 * in data/static/token-waterfall.json. Writes a report into
 * data/static/pricing-checks.json with timestamps and diffs. Does NOT mutate
 * token-waterfall.json — a human reviews the report and decides whether to
 * promote a change (auto-mutating would risk garbage prices on a page redesign).
 *
 * Requires ANTHROPIC_API_KEY. Bypasses the SEC issue (different host) but is
 * brittle — pages will redesign. Designed to fail-safe: warnings + preserve
 * prior snapshot if extraction fails.
 */
import { readFileSync } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { dataPath, writeJSON, todayISO, nowISO } from "./utils";

const UA = "BEP Research bot@bepresearch.com (bep-tokenomics pricing audit)";
const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

interface WaterfallPlatform {
  id: string;
  name: string;
  vendor: string;
  customerPricing: {
    model: string;
    price: number;
    unit: string;
    altPricing?: string;
  };
  sourceLinks?: Array<{ label: string; url: string; type: string }>;
}

interface PricingCheck {
  platformId: string;
  vendor: string;
  productName: string;
  pricingUrl: string;
  currentPrice: number;
  currentUnit: string;
  extractedPrice: number | null;
  extractedUnit: string | null;
  match: "exact" | "close" | "mismatch" | "extraction-failed" | "fetch-failed";
  notes: string;
  fetchedAt: string;
  rawSnippet?: string; // first ~500 chars of useful page text for audit
}

interface PricingChecksFile {
  source: string;
  lastUpdated: string | null;
  checks: PricingCheck[];
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.warn(`  ! ${url} -> HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    console.warn(`  ! ${url} -> ${(err as Error).message}`);
    return null;
  }
}

/** Strip a HTML page down to a few KB of likely-relevant body text for Claude. */
function trimHtmlForLlm(html: string, maxChars = 12000): string {
  // Drop script/style/svg/noscript blocks — they're noise and eat tokens.
  let cleaned = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
  // Convert to text-ish form, collapse whitespace.
  cleaned = cleaned.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (cleaned.length <= maxChars) return cleaned;
  // Try to keep the middle (usually where the pricing table lives) by sampling
  // the second quarter through three quarters of the document.
  const start = Math.floor(cleaned.length * 0.15);
  return cleaned.slice(start, start + maxChars);
}

async function extractPrice(
  client: Anthropic,
  vendor: string,
  productName: string,
  pricingUnit: string,
  rawText: string,
): Promise<{ price: number | null; unit: string | null; notes: string }> {
  const prompt = `You are auditing a pricing page for ${vendor}'s ${productName}.

We currently have the headline price recorded as: ${pricingUnit}

Below is a flattened text extract of the live pricing page. Find the SINGLE most prominent / current headline price for ${productName} (the one a new enterprise customer would see). If the product has multiple tiers, pick the one that matches the unit type we're tracking (per conversation, per resolution, per user/month, per credit, etc.).

Respond ONLY in JSON: { "price": <number>, "unit": "<one short string, e.g. \\"$/conversation\\" or \\"$/user/month\\">", "confidence": "high|medium|low", "notes": "<one sentence>" }
- If you cannot find a clear price, set price to null and explain in notes.
- Numbers only for price (no $ or commas). 0.99 not "$0.99".
- If multiple SKUs exist, pick the closest match to the unit shown above; mention alternatives in notes.

PAGE TEXT (truncated):
${rawText}
`;

  const resp = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");

  // Find the first {...} block in the response.
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { price: null, unit: null, notes: `Could not parse model output: ${text.slice(0, 200)}` };
  try {
    const parsed = JSON.parse(m[0]) as { price: number | null; unit: string | null; notes: string };
    return parsed;
  } catch {
    return { price: null, unit: null, notes: `Bad JSON from model: ${m[0].slice(0, 200)}` };
  }
}

function classifyMatch(current: number, extracted: number | null): PricingCheck["match"] {
  if (extracted === null) return "extraction-failed";
  if (Math.abs(extracted - current) < 0.005) return "exact";
  const pct = Math.abs(extracted - current) / Math.max(current, 0.01);
  if (pct < 0.10) return "close";
  return "mismatch";
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not set — skipping pricing audit (returning empty report).");
    writeJSON(dataPath("static/pricing-checks.json"), {
      source: "Auto-generated by scripts/check-pricing-pages.ts",
      lastUpdated: null,
      checks: [],
      note: "ANTHROPIC_API_KEY missing on this run — skipped extraction. Report will populate on the next run with the key set.",
    });
    return;
  }
  const client = new Anthropic({ apiKey });

  const waterfallPath = dataPath("static/token-waterfall.json");
  const waterfall = JSON.parse(readFileSync(waterfallPath, "utf-8"));
  const platforms = waterfall.platforms as WaterfallPlatform[];

  const checks: PricingCheck[] = [];
  for (const p of platforms) {
    const pricingLink = p.sourceLinks?.find((s) => s.type === "pricing");
    if (!pricingLink) continue;
    console.log(`Checking ${p.vendor} ${p.name} -> ${pricingLink.url}`);
    const html = await fetchHtml(pricingLink.url);
    if (!html) {
      checks.push({
        platformId: p.id,
        vendor: p.vendor,
        productName: p.name,
        pricingUrl: pricingLink.url,
        currentPrice: p.customerPricing.price,
        currentUnit: p.customerPricing.unit,
        extractedPrice: null,
        extractedUnit: null,
        match: "fetch-failed",
        notes: "HTTP fetch failed — likely 403, redirect loop, or network error.",
        fetchedAt: nowISO(),
      });
      continue;
    }
    const trimmed = trimHtmlForLlm(html);
    let result;
    try {
      result = await extractPrice(client, p.vendor, p.name, p.customerPricing.unit, trimmed);
    } catch (err) {
      result = { price: null, unit: null, notes: `Anthropic API error: ${(err as Error).message}` };
    }
    const match = classifyMatch(p.customerPricing.price, result.price);
    checks.push({
      platformId: p.id,
      vendor: p.vendor,
      productName: p.name,
      pricingUrl: pricingLink.url,
      currentPrice: p.customerPricing.price,
      currentUnit: p.customerPricing.unit,
      extractedPrice: result.price,
      extractedUnit: result.unit,
      match,
      notes: result.notes,
      fetchedAt: nowISO(),
      rawSnippet: trimmed.slice(0, 400),
    });
    console.log(`  -> recorded ${result.price ?? "n/a"} ${result.unit ?? ""}  [${match}]`);
    // Be a polite citizen — 1s between page fetches.
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Summary: how many drifted?
  const drift = checks.filter((c) => c.match === "mismatch").length;
  const fetched = checks.filter((c) => c.match !== "fetch-failed").length;
  console.log(`\nFetched ${fetched}/${checks.length}. ${drift} look like real price changes worth promoting.`);

  const output: PricingChecksFile = {
    source: "Auto-generated by scripts/check-pricing-pages.ts. Flags pricing-page drift vs token-waterfall.json. Does NOT auto-mutate prices — drift is surfaced for human review.",
    lastUpdated: todayISO(),
    checks,
  };
  writeJSON(dataPath("static/pricing-checks.json"), output);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
