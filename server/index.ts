import express from "express";
import compression from "compression";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { liveSources } from "../src/data/live-sources.js";
import { BrightDataClient } from "../src/lib/bright-data/client.js";
import { NvidiaNimProvider } from "../src/lib/ai/nvidia/provider.js";
import { ingestRows, MemoryIngestionStore } from "../src/lib/ingestion.js";
import { assertPublicHttpUrl } from "../src/lib/security.js";
import { scrapePublicSource } from "../src/lib/public-scrapers.js";
import { closeExpiredOpportunity } from "../src/lib/normalization.js";
import {
  getOpportunityIndex,
  priorIdsFromHistory,
  retrievalQuestion,
  type ChatTurn,
} from "../src/lib/ai/retrieval.js";
import { PostgresRepository } from "../db/repository.js";
import type { Opportunity, SourceConfig } from "../src/types.js";

const app = express();
app.use(compression());
app.use(express.json({ limit: "1mb" }));
const port = Number(process.env.API_PORT ?? 8787);
let brightDataToken = process.env.BRIGHT_DATA_API_TOKEN;
const brightDataCredentialsPath = process.env.BRIGHT_DATA_CREDENTIALS_PATH;
if (!brightDataToken && brightDataCredentialsPath && existsSync(brightDataCredentialsPath)) {
  try {
    const credential = JSON.parse(readFileSync(brightDataCredentialsPath, "utf8")) as {
      api_key?: string;
    };
    brightDataToken = credential.api_key;
  } catch {
    console.warn("Bright Data credentials could not be read; live collector runs are disabled.");
  }
}
const postgres = process.env.DATABASE_URL
  ? new PostgresRepository(process.env.DATABASE_URL)
  : null;
const recordedLiveMode = !postgres && process.env.DEMO_MODE === "recorded-live";
const MAX_CANONICAL_OPPORTUNITIES = 99_000;
const memoryStore = new MemoryIngestionStore();
const runtimeSources: SourceConfig[] = [...liveSources];
const replayPath = "fixtures/recorded-live/replay-opportunities.json.gz";
const replayOpportunities =
  recordedLiveMode && existsSync(replayPath)
    ? (JSON.parse(
        gunzipSync(readFileSync(replayPath)).toString("utf8"),
      ) as Opportunity[])
    : [];
replayOpportunities.forEach((opportunity) =>
  memoryStore.opportunities.set(opportunity.id, opportunity),
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
      rowCount: 882,
    },
    {
      id: "recorded-ted-public-run",
      sourceId: "21000000-0000-4000-8000-000000000009",
      collectionId: "public-ted-recorded-live",
      rowCount: 39593,
    },
    {
      id: "recorded-vendorpanel-bright-data-run",
      sourceId: "21000000-0000-4000-8000-000000000014",
      collectionId: "d2t1787074248760rm202d7du50g",
      rowCount: 50,
    },
    {
      id: "recorded-quebec-seao-public-run",
      sourceId: "21000000-0000-4000-8000-000000000010",
      collectionId: "public-quebec-seao-recorded-live",
      rowCount: 700,
    },
    {
      id: "recorded-texas-dot-public-run",
      sourceId: "21000000-0000-4000-8000-000000000011",
      collectionId: "public-texas-dot-recorded-live",
      rowCount: 342,
    },
    {
      id: "recorded-los-angeles-public-run",
      sourceId: "21000000-0000-4000-8000-000000000012",
      collectionId: "public-los-angeles-recorded-live",
      rowCount: 391,
    },
    {
      id: "recorded-chicago-public-run",
      sourceId: "21000000-0000-4000-8000-000000000005",
      collectionId: "public-chicago-recorded-live",
      rowCount: 25,
    },
    {
      id: "recorded-nyc-public-run",
      sourceId: "21000000-0000-4000-8000-000000000006",
      collectionId: "public-nyc-recorded-live",
      rowCount: 89,
    },
    {
      id: "recorded-montgomery-public-run",
      sourceId: "21000000-0000-4000-8000-000000000007",
      collectionId: "public-montgomery-recorded-live",
      rowCount: 13,
    },
    {
      id: "recorded-san-francisco-public-run",
      sourceId: "21000000-0000-4000-8000-000000000008",
      collectionId: "public-san-francisco-recorded-live",
      rowCount: 86,
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
const listCanonicalOpportunities = async (): Promise<Opportunity[]> =>
  (postgres
    ? await postgres.listOpportunities()
    : [...memoryStore.opportunities.values()]
  )
    .map((opportunity) => closeExpiredOpportunity(opportunity));
const listOpportunities = async () =>
  (await listCanonicalOpportunities()).slice(0, MAX_CANONICAL_OPPORTUNITIES);
const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const DEFAULT_CHAT_MODEL =
  process.env.NVIDIA_NIM_MODEL ?? "deepseek-ai/deepseek-v4-flash-0731";
type ChatModelMode = "non_reasoning" | "reasoning";
type ChatModelOption = { id: string; mode: ChatModelMode };
const REASONING_MODEL = /(?:reasoning|think(?:ing)?|deepseek-r1|qwq|gpt-oss|\bo[13]\b)/i;
const NON_CHAT_MODEL = /(?:embed|rerank|reward|guard|safety|content-safety|topic-control|parse|detector|video|clip|fuyu|deplot|diffusion|kosmos|neva|vila|riva|vision|\bvl\b|translate)/i;
const CHAT_MODEL_HINT = /(?:instruct|chat|llama|qwen|deepseek|mistral|mixtral|gemma|jamba|yi-large|dbrx|phi|nemotron|gpt-oss|minimax|kimi|laguna|step-|inkling|palmyra|glm|zamba|starcoder|codegemma|codestral)/i;
const isChatModel = (id: string) => !NON_CHAT_MODEL.test(id) && CHAT_MODEL_HINT.test(id);
let nvidiaModelsCache: { expiresAt: number; models: string[] } = {
  expiresAt: 0,
  models: [],
};
const nvidiaConfigured = () => Boolean(process.env.NVIDIA_API_KEY);
const nvidiaApiKey = () => {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA NIM not configured");
  return apiKey;
};
const listChatModels = async () => {
  if (!nvidiaConfigured()) return [];
  if (nvidiaModelsCache.expiresAt > Date.now()) return nvidiaModelsCache.models;
  try {
    const response = await fetch(`${NIM_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${nvidiaApiKey()}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error(`NVIDIA models returned ${response.status}`);
    const payload = (await response.json()) as { data?: Array<{ id?: string }> };
    const models = [...new Set(
      (payload.data ?? [])
        .map((candidate) => candidate.id?.trim())
        .filter((id): id is string => Boolean(id))
        .filter(isChatModel),
    )].sort((left, right) => left.localeCompare(right));
    nvidiaModelsCache = {
      expiresAt: Date.now() + 10 * 60_000,
      models: models.length ? models : [DEFAULT_CHAT_MODEL],
    };
  } catch {
    // Keep the assistant usable when NVIDIA's catalog endpoint is momentarily slow.
    nvidiaModelsCache = {
      expiresAt: Date.now() + 60_000,
      models: [DEFAULT_CHAT_MODEL],
    };
  }
  return nvidiaModelsCache.models;
};
const selectChatModel = async (requested?: string) => {
  const models = await listChatModels();
  if (!models.length) throw new Error("No NVIDIA chat models are available");
  if (requested && !models.includes(requested))
    throw new Error("That NVIDIA model is not in this account's catalog");
  return requested ?? (models.includes(DEFAULT_CHAT_MODEL) ? DEFAULT_CHAT_MODEL : models[0]!);
};
app.get("/api/health", (_request, response) =>
  response.json({
    ok: true,
    mode: postgres
      ? "postgres"
      : recordedLiveMode
        ? "recorded-live"
        : "unconfigured",
    brightDataConfigured: Boolean(brightDataToken),
    nvidiaConfigured: nvidiaConfigured(),
  }),
);
app.get("/api/copilot/models", async (_request, response) => {
  if (!nvidiaConfigured())
    return response.status(503).json({ error: "NVIDIA NIM not configured" });
  const models = await listChatModels();
  response.json({
    data: models.map((id): ChatModelOption => ({
      id,
      mode: REASONING_MODEL.test(id) ? "reasoning" : "non_reasoning",
    })),
    defaultModel: models.includes(DEFAULT_CHAT_MODEL) ? DEFAULT_CHAT_MODEL : models[0]!,
  });
});
app.get("/api/opportunities", async (_request, response) =>
  response.json({
    data: (await listOpportunities()).map((opportunity) => ({
      ...opportunity,
      raw: {},
      evidence: [],
      descriptionOriginal: null,
      descriptionEnglish: null,
    })),
    provenance: postgres
      ? "postgres"
      : recordedLiveMode
        ? "recorded_live"
        : "unconfigured",
    notice: postgres
      ? null
      : recordedLiveMode
        ? "Timestamped replay from completed source runs. Run configured sources for fresh accepted records."
        : "No accepted records are configured. Connect PostgreSQL and run authorised sources before using this environment.",
  }),
);
app.get("/api/opportunities/:id", async (request, response) => {
  const allOpportunities = await listOpportunities();
  const opportunity = allOpportunities.find(
    (candidate) => candidate.id === request.params.id,
  );
  if (!opportunity) return response.status(404).json({ error: "Opportunity not found" });
  return response.json({ data: opportunity });
});
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
  if (source.collectionMethod === "public_html" || source.collectionMethod === "public_api") {
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
      return response.json({
        run: result.run,
        validation: result.validation,
        publishedCount: result.published.length,
        preservedLastKnownGood: result.preservedLastKnownGood,
      });
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
const chatHistorySchema = z
  .array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().trim().min(1).max(4000),
      opportunityIds: z.array(z.string().min(1).max(200)).max(10).optional(),
    }),
  )
  .max(12)
  .optional()
  .default([]);
const historyTurns = (history: z.infer<typeof chatHistorySchema>): ChatTurn[] =>
  history.map(({ role, content, opportunityIds }) => ({ role, content, opportunityIds }));
app.post("/api/copilot", async (request, response) => {
  const schema = z.object({
    opportunityId: z.string(),
    question: z.string().min(2).max(2000),
    model: z.string().trim().min(1).max(180).optional(),
    history: chatHistorySchema,
  });
  const parsed = schema.safeParse(request.body);
  if (!parsed.success)
    return response
      .status(400)
      .json({ error: "A valid opportunity and question are required" });
  const allOpportunities = await listCanonicalOpportunities();
  const opportunity = allOpportunities.find(
    (item) => item.id === parsed.data.opportunityId,
  );
  if (!opportunity)
    return response.status(404).json({ error: "Opportunity not found" });
  if (!nvidiaConfigured())
    return response
      .status(503)
      .json({ error: "NVIDIA NIM not configured", code: "NIM_NOT_CONFIGURED" });
  try {
    const model = await selectChatModel(parsed.data.model);
    const provider = new NvidiaNimProvider({
      apiKey: nvidiaApiKey(),
      baseUrl: NIM_BASE_URL,
      model,
    });
    const workspace = postgres
      ? await postgres.getApplicationWorkspace(opportunity.id)
      : workspaces.get(opportunity.id);
    const turns = historyTurns(parsed.data.history);
    const index = getOpportunityIndex(allOpportunities);
    const retrieval = index.search(retrievalQuestion(parsed.data.question, turns), {
      priorIds: [...priorIdsFromHistory(turns), opportunity.id],
      limit: 6,
      skipTermRequirements: true,
    });
    const selfSimilar = index.search(
      [
        opportunity.titleOriginal,
        opportunity.titleEnglish ?? "",
        ...opportunity.industryCodes.map((code) => `${code.code} ${code.label ?? ""}`),
      ].join(" "),
      { status: "all", limit: 4 },
    );
    const candidatePool = new Map<string, Opportunity>();
    for (const hit of [...retrieval.hits, ...selfSimilar.hits]) {
      if (hit.item.id === opportunity.id) continue;
      candidatePool.set(hit.item.id, hit.item);
      if (candidatePool.size >= 6) break;
    }
    const candidates = [...candidatePool.values()];
    const result = await provider.chat({
      question: parsed.data.question,
      history: turns.map(({ role, content }) => ({ role, content })),
      opportunity,
      relatedOpportunities: candidates,
      workspace: workspace ?? undefined,
      mode: "record",
    });
    response.json({
      ...result,
      recordsSearched: allOpportunities.length,
      recordsRead: candidates.length + 1,
      appliedFilters: retrieval.appliedFilters,
    });
  } catch (error) {
    console.error("[copilot] request failed:", error);
    response.status(502).json({
      error: "The AI service could not answer right now. Try again shortly.",
    });
  }
});
app.post("/api/copilot/search", async (request, response) => {
  const parsed = z
    .object({
      question: z.string().trim().min(2).max(2000),
      model: z.string().trim().min(1).max(180).optional(),
      history: chatHistorySchema,
    })
    .safeParse(request.body);
  if (!parsed.success)
    return response.status(400).json({ error: "Enter a contract need to search for" });
  const all = await listCanonicalOpportunities();
  const turns = historyTurns(parsed.data.history);
  const sources = await listSources();
  const sourceNames = new Map(sources.map((source) => [source.id, source.name]));
  const index = getOpportunityIndex(all);
  const priorIdSet = [...new Set(priorIdsFromHistory(turns))];
  const retrieval = index.search(retrievalQuestion(parsed.data.question, turns), {
    priorIds: priorIdSet,
    limit: 24,
  });
  const candidates = retrieval.hits.map((hit) => hit.item);
  if (priorIdSet.length) {
    const known = new Set(candidates.map((item) => item.id));
    for (const priorId of priorIdSet.slice(0, 10)) {
      if (known.size >= 30) break;
      const record =
        all.find((item) => item.id === priorId) ?? null;
      if (record && !known.has(record.id)) {
        candidates.push(record);
        known.add(record.id);
      }
    }
  }
  const appliedFilters = retrieval.appliedFilters;
  const sourceSummary = Object.entries(
    candidates.reduce<Record<string, number>>((counts, item) => {
      const name = sourceNames.get(item.sourceId) ?? item.sourceId;
      counts[name] = (counts[name] ?? 0) + 1;
      return counts;
    }, {}),
  ).sort((left, right) => right[1] - left[1]);
  if (!candidates.length)
    return response.json({
      answer: `No accepted contract records matched all requested criteria: ${appliedFilters.join(", ")}. Try broadening the capability or deadline window.`,
      evidenceFields: [],
      opportunityIds: [],
      draft: true,
      recordsSearched: all.length,
      recordsRead: 0,
      appliedFilters,
      sourceSummary,
    });
  const shortlist = candidates.slice(0, 3);
  const fallback = `I found ${candidates.length} accepted contract record${candidates.length === 1 ? "" : "s"} matching ${appliedFilters.join(", ")}, drawn from ${sourceSummary.length} source${sourceSummary.length === 1 ? "" : "s"} (${sourceSummary.slice(0, 4).map(([name, count]) => `${name}: ${count}`).join(", ")}). The strongest leads are ${shortlist.map((item) => `${item.titleOriginal} (${item.buyerOriginal}, ${item.countryName})`).join("; ")}. Open each official record below to confirm scope, eligibility, amendments, and deadlines.`;
  const recordsRead = Math.min(candidates.length, 8);
  const basePayload = {
    evidenceFields: [] as string[],
    opportunityIds: shortlist.map((item) => item.id),
    draft: true,
    recordsSearched: all.length,
    recordsRead,
    appliedFilters,
    sourceSummary,
  };
  if (!nvidiaConfigured())
    return response.json({
      answer: fallback,
      ...basePayload,
      warning: "NVIDIA NIM is not configured",
    });
  try {
    const model = await selectChatModel(parsed.data.model);
    const provider = new NvidiaNimProvider({
      apiKey: nvidiaApiKey(),
      baseUrl: NIM_BASE_URL,
      model,
    });
    const result = await provider.chat({
      question: parsed.data.question,
      history: turns.map(({ role, content }) => ({ role, content })),
      opportunity: candidates[0]!,
      relatedOpportunities: candidates.slice(0, 12),
      mode: "search",
    });
    const answer =
      result.answer.trim().length < 80 ? fallback : result.answer;
    return response.json({
      ...result,
      answer,
      opportunityIds: result.opportunityIds.length
        ? result.opportunityIds
        : shortlist.map((item) => item.id),
      recordsSearched: all.length,
      recordsRead,
      appliedFilters,
      sourceSummary,
    });
  } catch (error) {
    console.error("[copilot/search] falling back to deterministic results:", error);
    return response.json({
      answer: fallback,
      ...basePayload,
      warning: "NVIDIA NIM was unavailable; showing deterministic retrieved results.",
    });
  }
});
app.listen(port, () =>
  console.log(`SecureContract API listening on http://localhost:${port}`),
);
