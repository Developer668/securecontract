import { mkdirSync, writeFileSync } from "node:fs";
import { liveSources } from "../src/data/live-sources.js";
import { scrapePublicSource } from "../src/lib/public-scrapers.js";

const captures = [
  ["canada-canadabuys", "fixtures/recorded-live/canada-canadabuys/run-live.json"],
  ["eu-ted-open-notices", "fixtures/recorded-live/eu-ted/run-live.json"],
  ["us-chicago-solicitations", "fixtures/recorded-live/us-chicago/run-live.json"],
  ["us-nyc-current-bids", "fixtures/recorded-live/us-nyc/run-live.json"],
  ["us-montgomery-solicitations", "fixtures/recorded-live/us-montgomery/run-live.json"],
  ["us-san-francisco-bids", "fixtures/recorded-live/us-san-francisco/run-live.json"],
] as const;

for (const [slug, path] of captures) {
  const source = liveSources.find((candidate) => candidate.slug === slug);
  if (!source) throw new Error(`Missing source configuration: ${slug}`);
  if (source.status !== "active") {
    console.log(JSON.stringify({ slug, skipped: true, reason: `source is ${source.status}` }));
    continue;
  }
  const rows = await scrapePublicSource(source);
  if (!rows.length) throw new Error(`${slug} returned no public rows`);
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, `${JSON.stringify(rows, null, 2)}\n`);
  console.log(JSON.stringify({ slug, rows: rows.length, path }));
}
