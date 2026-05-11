import type { Metadata } from "next";
import HomeContent from "./HomeContent";

export const revalidate = 3600;

const FALLBACK_POST_COUNT = 62;

const HOME_TITLE = "BEP Research — AI Infrastructure Intelligence by Ben Pouladian";
const HOME_DESCRIPTION =
  "System-level AI infrastructure research by Ben Pouladian. Live GPU pricing and inference margins, plus deep coverage of AI semiconductors, HBM economics, optical interconnects, advanced packaging, NeoCloud, and datacenter power.";

export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "https://www.bepresearch.com/",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    creator: "@benitoz",
    site: "@benitoz",
  },
};

async function fetchSubstackPostCount(): Promise<number> {
  let total = 0;
  let offset = 0;

  // Substack ignores `limit` and decides page size on its own, so we keep
  // paging until it returns an empty array.
  while (offset < 2000) {
    const res = await fetch(
      `https://bepresearch.substack.com/api/v1/archive?sort=new&search=&offset=${offset}&limit=50`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) throw new Error(`Substack archive fetch failed: ${res.status}`);
    const batch = (await res.json()) as unknown[];
    if (!Array.isArray(batch) || batch.length === 0) break;
    total += batch.length;
    offset += batch.length;
  }

  return total;
}

export default async function Home() {
  let postCount = FALLBACK_POST_COUNT;
  try {
    postCount = await fetchSubstackPostCount();
  } catch {
    // Keep fallback if Substack is unreachable at build/revalidate time.
  }
  return <HomeContent postCount={postCount} />;
}
