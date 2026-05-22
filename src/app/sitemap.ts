import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = "https://www.bepresearch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${SITE_URL}/tokenomics/v2`, lastModified: now, changeFrequency: "daily", priority: 0.95 },
    { url: `${SITE_URL}/tokenomics/providers`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tokenomics/frontier`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tokenomics/cost-per-task`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/tokenomics/deep-dive`, lastModified: now, changeFrequency: "weekly", priority: 0.85 },
    { url: `${SITE_URL}/tokenomics/hardware`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/tokenomics/margins`, lastModified: now, changeFrequency: "daily", priority: 0.85 },
    { url: `${SITE_URL}/tokenomics/tco`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${SITE_URL}/tokenomics/waterfall`, lastModified: now, changeFrequency: "weekly", priority: 0.75 },
    { url: `${SITE_URL}/tokenomics/sources`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];
}
