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

const aslSource = liveSources.find((source) => source.slug === "australia-asl-tenders");
const ccaSource = liveSources.find((source) => source.slug === "california-cca-procurement");
const aaiSource = liveSources.find((source) => source.slug === "india-aai-publications");
if (!aslSource || !ccaSource || !aaiSource) throw new Error("Recorded source configuration is incomplete");

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
      "Completed Bright Data custom collector dataset run",
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
      replayProvenance: "completed_bright_data_dataset_run",
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
      provenance: "completed_bright_data_dataset_run",
      notice:
        "Canonical example derived from the completed ASL custom collector dataset run. Any preview-only source remains identified separately in the manifest.",
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
  }),
);
