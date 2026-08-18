import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { liveSources } from "../../src/data/live-sources";
import { ingestRows, MemoryIngestionStore } from "../../src/lib/ingestion";
import { adapterFor } from "../../src/lib/sources";

const readJson = <T>(path: string) =>
  JSON.parse(readFileSync(path, "utf8")) as T;

describe("recorded Bright Data contracts", () => {
  it("validates every row in the completed AAI post-heal dataset", () => {
    const source = liveSources.find((item) => item.slug === "india-aai-publications")!;
    const rows = readJson<unknown[]>("fixtures/recorded-live/india-aai/post-heal.json");
    const adapter = adapterFor(source.adapterKey);
    expect(rows).toHaveLength(234);
    expect(rows.every((row) => adapter.rawSchema.safeParse(row).success)).toBe(true);
  });

  it("publishes the completed ASL dataset through the canonical boundary", async () => {
    const source = liveSources.find((item) => item.slug === "australia-asl-tenders")!;
    const rows = readJson<unknown[]>("fixtures/recorded-live/australia-asl/run-v3.json");
    const store = new MemoryIngestionStore();
    const result = await ingestRows({
      source,
      collectionId: "completed-dataset-contract-test",
      rows,
      store,
      observedAt: "2026-08-17T23:55:00.000Z",
    });
    expect(result.run.status).toBe("healthy");
    expect(result.published).toHaveLength(4);
    expect(store.rawRecords).toHaveLength(4);
  });

  it("archives the CCA wrapper and publishes its nested completed-run row", async () => {
    const source = liveSources.find((item) => item.slug === "california-cca-procurement")!;
    const rows = readJson<unknown[]>("fixtures/recorded-live/california-cca/post-heal-v3.json");
    const store = new MemoryIngestionStore();
    const result = await ingestRows({
      source,
      collectionId: "completed-nested-dataset-test",
      rows,
      store,
      observedAt: "2026-08-17T23:55:00.000Z",
    });
    expect(result.run.status).toBe("healthy");
    expect(result.published).toHaveLength(1);
    expect(result.published[0]?.submissionDueAt).toBeNull();
    expect(store.rawRecords).toHaveLength(1);
    expect(store.rawRecords[0]?.raw).toHaveProperty("opportunities");
    expect(store.opportunities.size).toBe(1);
  });
});
