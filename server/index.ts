import express from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import {
  opportunities as demonstrationOpportunities,
  sources as demonstrationSources,
} from "../src/data/demo.js";
import { liveSources } from "../src/data/live-sources.js";
import { BrightDataClient } from "../src/lib/bright-data/client.js";
import { NvidiaNimProvider } from "../src/lib/ai/nvidia/provider.js";
import { ingestRows, MemoryIngestionStore } from "../src/lib/ingestion.js";
import { assertPublicHttpUrl } from "../src/lib/security.js";
import { scrapePublicSource } from "../src/lib/public-scrapers.js";
import { PostgresRepository } from "../db/repository.js";
import type { SourceConfig } from "../src/types.js";

const app = express();
app.use(express.json({ limit: "1mb" }));
const port = Number(process.env.API_PORT ?? 8787);
let brightDataToken = process.env.BRIGHT_DATA_API_TOKEN;
if (!brightDataToken && process.env.BRIGHT_DATA_CREDENTIALS_PATH) {
  const credential = JSON.parse(
    readFileSync(process.env.BRIGHT_DATA_CREDENTIALS_PATH, "utf8"),
  ) as { api_key?: string };
  brightDataToken = credential.api_key;
}
const postgres = process.env.DATABASE_URL
  ? new PostgresRepository(process.env.DATABASE_URL)
  : null;
const recordedLiveMode = !postgres && process.env.DEMO_MODE === "recorded-live";
const memoryStore = new MemoryIngestionStore();
const runtimeSources: SourceConfig[] = [
  ...(recordedLiveMode ? liveSources : demonstrationSources),
];
const replayPath = "fixtures/recorded-live/replay-opportunities.json";
const replayOpportunities =
  recordedLiveMode && existsSync(replayPath)
    ? (JSON.parse(
        readFileSync(replayPath, "utf8"),
      ) as typeof demonstrationOpportunities)
    : [];
(recordedLiveMode ? replayOpportunities : demonstrationOpportunities).forEach(
  (opportunity) => memoryStore.opportunities.set(opportunity.id, opportunity),
);
if (recordedLiveMode) {
  memoryStore.runs.push({
    id: "recorded-asl-run-v3",
    sourceId: "21000000-0000-4000-8000-000000000003",
    collectionId: "d2t1787014014069rrj38shevv9o",
    status: "healthy",
    rowCount: 4,
    validRowCount: 4,
    metrics: {
      rowCount: 4,
      baselineRowCount: null,
      requiredFieldCompleteness: 1,
      dateParseRate: 1,
      duplicateRate: 0,
      schemaStability: 1,
      freshness: 1,
      accessWallDetected: false,
    },
    problems: [],
    startedAt: "2026-08-18T00:49:34.211Z",
    finishedAt: "2026-08-18T00:50:07.180Z",
  });
  memoryStore.runs.push({
    id: "recorded-cca-post-heal-v3",
    sourceId: "21000000-0000-4000-8000-000000000002",
    collectionId: "d2t1787014744903r0r6ggh7kkeg",
    status: "healthy",
    rowCount: 1,
    validRowCount: 1,
    metrics: {
      rowCount: 1,
      baselineRowCount: null,
      requiredFieldCompleteness: 1,
      dateParseRate: 1,
      duplicateRate: 0,
      schemaStability: 1,
      freshness: 1,
      accessWallDetected: false,
    },
    problems: [],
    startedAt: "2026-08-18T00:58:55.000Z",
    finishedAt: "2026-08-18T00:59:05.000Z",
  });
  for (const recorded of [
    {
      id: "recorded-canadabuys-public-run",
      sourceId: "21000000-0000-4000-8000-000000000004",
      collectionId: "public-canadabuys-recorded-live",
      rowCount: 25,
    },
    {
      id: "recorded-chicago-public-run",
      sourceId: "21000000-0000-4000-8000-000000000005",
      collectionId: "public-chicago-recorded-live",
      rowCount: 25,
    },
  ]) {
    memoryStore.runs.push({
      ...recorded,
      status: "healthy",
      validRowCount: recorded.rowCount,
      metrics: {
        rowCount: recorded.rowCount,
        baselineRowCount: null,
        requiredFieldCompleteness: 1,
        dateParseRate: 1,
        duplicateRate: 0,
        schemaStability: 1,
        freshness: 1,
        accessWallDetected: false,
      },
      problems: [],
      startedAt: "2026-08-18T04:15:00.000Z",
      finishedAt: "2026-08-18T04:15:03.000Z",
    });
  }
}
const pendingRuns = new Map<
  string,
  { id: string; sourceId: string; startedAt: string }
>();
const workspaces = new Map<
  string,
  {
    status: string;
    notes: string;
    tasks: Array<{
      id: string;
      label: string;
      status: "todo" | "done" | "blocked";
    }>;
  }
>();
const cron = (
  request: express.Request,
  response: express.Response,
  next: express.NextFunction,
) => {
  const configured = process.env.CRON_SECRET;
  if (!configured || request.header("authorization") !== `Bearer ${configured}`)
    return response.status(401).json({ error: "Cron authorization required" });
  next();
};

const listSources = async (): Promise<SourceConfig[]> =>
  postgres ? postgres.listSources() : runtimeSources;
const listOpportunities = async () =>
  postgres
    ? postgres.listOpportunities()
    : [...memoryStore.opportunities.values()];
app.get("/api/health", (_request, response) =>
  response.json({
    ok: true,
    mode: postgres
      ? "postgres"
      : recordedLiveMode
        ? "recorded-live"
        : "demonstration",
    brightDataConfigured: Boolean(brightDataToken),
    nvidiaConfigured: Boolean(
      process.env.NVIDIA_API_KEY && process.env.NVIDIA_NIM_MODEL,
    ),
  }),
);
app.get("/api/opportunities", async (_request, response) =>
  response.json({
    data: await listOpportunities(),
    provenance: postgres
      ? "postgres"
      : recordedLiveMode
        ? "recorded_live"
        : "demonstration_fixture",
    notice: postgres
      ? null
      : recordedLiveMode
        ? "Timestamped replay from completed Bright Data and public-page scraper runs across the US, Canada, and Australia; run live sources for fresh data."
        : "These rows demonstrate the product workflow and are not represented as live Bright Data output.",
  }),
);
app.get("/api/sources", async (_request, response) => {
  const sourceList = await listSources();
  const runs = postgres ? await postgres.listRuns() : memoryStore.runs;
  response.json({
    data: sourceList.map((source) => {
      const sourceRuns = runs
        .filter((run) => run.sourceId === source.id)
        .sort(
          (left, right) =>
            new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime(),
        );
      const latestRun = sourceRuns[0] ?? null;
      const lastSuccessfulRun =
        sourceRuns.find(
          (run) => run.status === "healthy" || run.status === "warning",
        ) ?? null;
      const status =
        latestRun?.status === "failed" || latestRun?.status === "degraded"
          ? "degraded"
          : source.status;
      return { ...source, status, latestRun, lastSuccessfulRun };
    }),
  });
});
app.post("/api/sources", async (request, response) => {
  const schema = z.object({
    countryCode: z
      .string()
      .trim()
      .min(2)
      .max(3)
      .transform((value) => value.toUpperCase()),
    countryName: z.string().trim().min(2).max(100),
    jurisdictionType: z.enum([
      "national",
      "state",
      "province",
      "region",
      "county",
      "municipality",
      "agency",
      "other",
    ]),
    jurisdictionName: z.string().trim().max(160).nullable(),
    name: z.string().trim().min(2).max(180),
    sourceUrl: z.string().url(),
    locale: z.string().trim().min(2).max(35),
    timezone: z.string().trim().min(3).max(80),
    currency: z.string().trim().max(3).nullable(),
    sourceLanguage: z.string().trim().min(2).max(15),
  });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success)
    return response
      .status(400)
      .json({ error: "Source details are incomplete or invalid" });
  try {
    const url = assertPublicHttpUrl(parsed.data.sourceUrl);
    const probe = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
      headers: { "User-Agent": "SecureContract source acceptance check" },
    });
    const sample = (await probe.text()).slice(0, 80_000).toLowerCase();
    if (!probe.ok) throw new Error(`Public URL returned ${probe.status}`);
    if (
      /sign[ -]?in required|login required|access denied|captcha required/.test(
        sample,
      )
    )
      throw new Error(
        "The target appears to require authentication or CAPTCHA",
      );
    const slugBase = `${parsed.data.countryCode}-${parsed.data.name}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 90);
    const source: SourceConfig = {
      id: randomUUID(),
      slug: `${slugBase}-${randomUUID().slice(0, 8)}`,
      ...parsed.data,
      jurisdictionName: parsed.data.jurisdictionName || null,
      currency: parsed.data.currency || null,
      inputUrl: url.toString(),
      sourceUrl: url.toString(),
      collectorId: null,
      adapterKey: "declarative",
      status: "draft",
      requiredFields: ["title", "detail_url"],
      publicAccessVerifiedAt: new Date().toISOString(),
      prebuiltLibraryCheckedAt: null,
    };
    if (postgres) await postgres.upsertSources([source]);
    else runtimeSources.push(source);
    response
      .status(201)
      .json({
        data: source,
        next: "Verify the Bright Data library, create a custom collector, inspect a sample run, then map and activate.",
      });
  } catch (error) {
    response
      .status(422)
      .json({
        error:
          error instanceof Error
            ? error.message
            : "Public access verification failed",
      });
  }
});
app.get("/api/applications/:opportunityId", async (request, response) => {
  const opportunityId = String(request.params.opportunityId);
  const persisted = postgres
    ? await postgres.getApplicationWorkspace(opportunityId)
    : workspaces.get(opportunityId);
  response.json(
    persisted ?? {
      status: "not_started",
      notes: "",
      tasks: [
        {
          id: "task-verify",
          label: "Verify the deadline on the official portal",
          status: "todo",
        },
        { id: "task-docs", label: "Review required documents", status: "todo" },
      ],
    },
  );
});
app.put("/api/applications/:opportunityId", async (request, response) => {
  const workspaceSchema = z.object({
    status: z.enum([
      "not_started",
      "reviewing",
      "preparing",
      "ready_for_review",
      "submitted_manually",
      "archived",
    ]),
    notes: z.string().max(10000),
    tasks: z.array(
      z.object({
        id: z.string(),
        label: z.string().min(1).max(300),
        status: z.enum(["todo", "done", "blocked"]),
      }),
    ),
  });
  const parsed = workspaceSchema.safeParse(request.body);
  if (!parsed.success)
    return response.status(400).json({ error: parsed.error.flatten() });
  const opportunityId = String(request.params.opportunityId);
  if (postgres)
    return response.json(
      await postgres.saveApplicationWorkspace(opportunityId, parsed.data),
    );
  workspaces.set(opportunityId, parsed.data);
  response.json(parsed.data);
});
app.post("/api/runs/:sourceId", async (request, response) => {
  const sourceId = String(request.params.sourceId);
  const source = (await listSources()).find((item) => item.id === sourceId);
  if (!source) return response.status(404).json({ error: "Source not found" });
  if (source.collectionMethod === "public_html") {
    try {
      const collectionId = `public-${source.slug}-${Date.now()}`;
      const rows = await scrapePublicSource(source);
      const result = await ingestRows({
        source,
        collectionId,
        rows,
        store: postgres ?? memoryStore,
        observedAt: new Date().toISOString(),
        publish: source.publishToOpportunityFeed !== false,
      });
      return response.json(result);
    } catch (error) {
      return response.status(502).json({
        error: error instanceof Error ? error.message : "Public scraper failed",
      });
    }
  }
  if (!source.collectorId)
    return response.status(409).json({
      error:
        "No real Collector ID is configured for this source. Create and verify a custom scraper first.",
    });
  if (!brightDataToken)
    return response
      .status(503)
      .json({ error: "Bright Data is not configured" });
  try {
    const client = new BrightDataClient(brightDataToken);
    const collectionId = await client.trigger(
      source.collectorId,
      source.inputUrl,
    );
    const pending = {
      id: randomUUID(),
      sourceId: source.id,
      startedAt: new Date().toISOString(),
    };
    pendingRuns.set(collectionId, pending);
    await (postgres ?? memoryStore).createRun({
      id: pending.id,
      sourceId: source.id,
      collectionId,
      status: "pending",
      startedAt: pending.startedAt,
    });
    response
      .status(202)
      .json({ collectionId, runId: pending.id, status: "pending" });
  } catch (error) {
    response.status(502).json({
      error:
        error instanceof Error ? error.message : "Collection trigger failed",
    });
  }
});
app.get("/api/runs/poll/:snapshotId", async (request, response) => {
  if (!brightDataToken)
    return response
      .status(503)
      .json({ error: "Bright Data is not configured" });
  try {
    const snapshotId = String(request.params.snapshotId);
    const body = await new BrightDataClient(brightDataToken).dataset(
      snapshotId,
    );
    if (!Array.isArray(body)) return response.status(202).json(body);
    const pending =
      pendingRuns.get(snapshotId) ??
      (postgres ? await postgres.findRunByCollectionId(snapshotId) : null);
    if (!pending)
      return response.status(409).json({
        error: "No persisted SecureContract run matches this collection ID",
      });
    const source = (await listSources()).find(
      (item) => item.id === pending.sourceId,
    );
    if (!source)
      return response
        .status(409)
        .json({ error: "The source for this run no longer exists" });
    const result = await ingestRows({
      source,
      collectionId: snapshotId,
      rows: body,
      store: postgres ?? memoryStore,
      runId: pending.id,
      runAlreadyCreated: true,
      observedAt: pending.startedAt,
      publish: source.publishToOpportunityFeed !== false,
    });
    pendingRuns.delete(snapshotId);
    response.json(result);
  } catch (error) {
    response.status(502).json({
      error:
        error instanceof Error ? error.message : "Collection polling failed",
    });
  }
});
app.get("/api/healing", (_request, response) =>
  response.json({
    data: [
      {
        sourceId: "21000000-0000-4000-8000-000000000001",
        sourceName: "Airports Authority of India — Tender Publication Index",
        collectorId: "c_msxulljug99b25hby",
        status: "verified",
        detected: "Collector returned 234 wrapper rows with empty publication arrays.",
        repair: "Flatten publication metadata while preserving the public document URL.",
        outcome: "234 valid rows after approval and same-ID rerun.",
        sameCollectorId: true,
        proposalReviewed: true,
        approved: true,
      },
      {
        sourceId: "21000000-0000-4000-8000-000000000002",
        sourceName: "California Community Choice Association Procurement",
        collectorId: "c_msxy8dx318cy3aekq5",
        status: "contained",
        detected: "Collector deployed a nested opportunities wrapper instead of flat rows.",
        repair: "Same-ID flattening repair was reviewed and approved in Scraper Studio.",
        outcome: "The wrapper remained upstream, so SecureContract archives it first and safely flattens at the adapter boundary.",
        sameCollectorId: true,
        proposalReviewed: true,
        approved: true,
      },
    ],
  }),
);
app.post("/api/cron/collect", cron, async (_request, response) => {
  if (!brightDataToken)
    return response
      .status(503)
      .json({ error: "Bright Data is not configured" });
  const allSources = await listSources();
  const configured = allSources.filter(
    (source) => source.status === "active" && source.collectorId,
  );
  const client = new BrightDataClient(brightDataToken);
  const triggered = await Promise.all(
    configured.map(async (source) => {
      const collectionId = await client.trigger(
        source.collectorId!,
        source.inputUrl,
      );
      const pending = {
        id: randomUUID(),
        sourceId: source.id,
        startedAt: new Date().toISOString(),
      };
      pendingRuns.set(collectionId, pending);
      await (postgres ?? memoryStore).createRun({
        id: pending.id,
        sourceId: source.id,
        collectionId,
        status: "pending",
        startedAt: pending.startedAt,
      });
      return { sourceId: source.id, collectionId, runId: pending.id };
    }),
  );
  response
    .status(202)
    .json({ triggered, skipped: allSources.length - configured.length });
});
app.post("/api/copilot", async (request, response) => {
  const schema = z.object({
    opportunityId: z.string(),
    question: z.string().min(2).max(2000),
  });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success)
    return response
      .status(400)
      .json({ error: "A valid opportunity and question are required" });
  const opportunity = (await listOpportunities()).find(
    (item) => item.id === parsed.data.opportunityId,
  );
  if (!opportunity)
    return response.status(404).json({ error: "Opportunity not found" });
  if (!process.env.NVIDIA_API_KEY || !process.env.NVIDIA_NIM_MODEL)
    return response
      .status(503)
      .json({ error: "NVIDIA NIM not configured", code: "NIM_NOT_CONFIGURED" });
  try {
    const provider = new NvidiaNimProvider({
      apiKey: process.env.NVIDIA_API_KEY,
      baseUrl:
        process.env.NVIDIA_NIM_BASE_URL ??
        "https://integrate.api.nvidia.com/v1",
      model: process.env.NVIDIA_NIM_MODEL,
    });
    const workspace = postgres
      ? await postgres.getApplicationWorkspace(opportunity.id)
      : workspaces.get(opportunity.id);
    response.json(
      await provider.chat({
        question: parsed.data.question,
        opportunity,
        workspace: workspace ?? undefined,
      }),
    );
  } catch (error) {
    response.status(502).json({
      error: error instanceof Error ? error.message : "Copilot request failed",
    });
  }
});
app.listen(port, () =>
  console.log(`SecureContract API listening on http://localhost:${port}`),
);
