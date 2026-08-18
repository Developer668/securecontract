import { readFileSync, writeFileSync } from "node:fs";
import { ingestRows, MemoryIngestionStore } from "../src/lib/ingestion.js";
import { liveSources } from "../src/data/live-sources.js";

const observedAt = "2026-08-17T23:55:00.000Z";
const store = new MemoryIngestionStore();

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const aslRows = readJson<unknown[]>(
  "fixtures/recorded-live/australia-asl/run-v3.json",
);
const ccaRows = readJson<unknown[]>(
  "fixtures/recorded-live/california-cca/post-heal-v3.json",
);
const aaiRows = readJson<unknown[]>(
  "fixtures/recorded-live/india-aai/post-heal.json",
);
const canadaRows = readJson<unknown[]>(
  "fixtures/recorded-live/canada-canadabuys/run-live.json",
);
const chicagoRows = readJson<unknown[]>(
  "fixtures/recorded-live/us-chicago/run-live.json",
);

const aslSource = liveSources.find((source) => source.slug === "australia-asl-tenders");
const ccaSource = liveSources.find((source) => source.slug === "california-cca-procurement");
const aaiSource = liveSources.find((source) => source.slug === "india-aai-publications");
const canadaSource = liveSources.find((source) => source.slug === "canada-canadabuys");
const chicagoSource = liveSources.find((source) => source.slug === "us-chicago-solicitations");
if (!aslSource || !ccaSource || !aaiSource || !canadaSource || !chicagoSource)
  throw new Error("Recorded source configuration is incomplete");

const aslResult = await ingestRows({
  source: aslSource,
  collectionId: "d2t1787014014069rrj38shevv9o",
  rows: aslRows,
  store,
  observedAt,
});
const ccaResult = await ingestRows({
  source: ccaSource,
  collectionId: "d2t1787014744903r0r6ggh7kkeg",
  rows: ccaRows,
  store,
  observedAt,
});
const canadaResult = await ingestRows({
  source: canadaSource,
  collectionId: "public-canadabuys-recorded-live",
  rows: canadaRows,
  store,
  observedAt,
});
const chicagoResult = await ingestRows({
  source: chicagoSource,
  collectionId: "public-chicago-recorded-live",
  rows: chicagoRows,
  store,
  observedAt,
});

// The AAI run is a real post-heal publication index. Validate its source
// contract separately; it is not promoted as a canonical contract opportunity.
const aaiContractRows = aaiRows.filter(
  (row): row is Record<string, unknown> =>
    Boolean(row) && typeof row === "object" && !Array.isArray(row),
);
const aaiValidCount = aaiContractRows.filter(
  (row) =>
    typeof row.publication_title === "string" &&
    typeof row.document_url === "string" &&
    URL.canParse(row.document_url),
).length;

const opportunities = [...store.opportunities.values()].map((opportunity) => ({
  ...opportunity,
  raw: {
    ...opportunity.raw,
    extraction_evidence:
      opportunity.sourceId === canadaSource.id || opportunity.sourceId === chicagoSource.id
        ? "Completed public-page scraper run"
        : "Completed Bright Data custom collector dataset run",
  },
}));

writeFileSync(
  "fixtures/recorded-live/replay-opportunities.json",
  `${JSON.stringify(opportunities, null, 2)}\n`,
);
writeFileSync(
  "fixtures/recorded-live/replay-manifest.json",
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      replayProvenance: "completed_live_scraper_runs",
      canonicalOpportunityCount: opportunities.length,
      sourceResults: [
        {
          slug: aslSource.slug,
          collectorId: aslSource.collectorId,
          artifact: "australia-asl/run-v3.json",
          artifactKind: "completed custom collector dataset run",
          runStatus: aslResult.run.status,
          published: aslResult.published.length,
        },
        {
          slug: ccaSource.slug,
          collectorId: ccaSource.collectorId,
          artifact: "california-cca/post-heal-v3.json",
          artifactKind: "completed post-heal custom collector dataset run",
          runStatus: ccaResult.run.status,
          published: ccaResult.published.length,
          archivedShape: "one immutable wrapper row; flattened after archival",
        },
        {
          slug: canadaSource.slug,
          collectorId: null,
          artifact: "canada-canadabuys/run-live.json",
          artifactKind: "completed public-page scraper run",
          runStatus: canadaResult.run.status,
          published: canadaResult.published.length,
        },
        {
          slug: chicagoSource.slug,
          collectorId: null,
          artifact: "us-chicago/run-live.json",
          artifactKind: "completed public-page scraper run",
          runStatus: chicagoResult.run.status,
          published: chicagoResult.published.length,
        },
        {
          slug: aaiSource.slug,
          collectorId: aaiSource.collectorId,
          artifact: "india-aai/post-heal.json",
          artifactKind: "completed post-heal dataset run",
          rows: aaiContractRows.length,
          contractValidRows: aaiValidCount,
          promotedToOpportunities: false,
        },
      ],
    },
    null,
    2,
  )}\n`,
);
writeFileSync(
  "examples/structured-output.json",
  `${JSON.stringify(
    {
      provenance: "completed_live_scraper_runs",
      notice:
        "Canonical example derived from completed Bright Data and public-page scraper runs. Any preview-only source remains identified separately in the manifest.",
      data: opportunities,
    },
    null,
    2,
  )}\n`,
);

console.log(
  JSON.stringify({
    opportunities: opportunities.length,
    aslStatus: aslResult.run.status,
    ccaStatus: ccaResult.run.status,
    aaiContractValidRows: aaiValidCount,
    canadaStatus: canadaResult.run.status,
    chicagoStatus: chicagoResult.run.status,
  }),
);
