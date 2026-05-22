// Belt-and-suspenders for the /preview/nebius route on Cloudflare Pages.
//
// Next.js static export produces out/preview/nebius.html plus an out/preview/nebius/
// directory that contains only Next.js metadata sidecars (no index.html). Different
// CDN edge nodes resolve the bare /preview/nebius URL differently — some serve the
// .html sibling, some try to treat the directory as an index path and 404. This
// script copies nebius.html into nebius/index.html so the route resolves correctly
// regardless of how the edge interprets the URL.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const src = resolve("out/preview/nebius.html");
const dst = resolve("out/preview/nebius/index.html");

if (!existsSync(src)) {
  console.error(`[postbuild] source missing: ${src}`);
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`[postbuild] copied nebius.html → nebius/index.html`);
