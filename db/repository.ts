import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { Opportunity, SourceConfig } from "../src/types.js";
import type {
  ArchivedRawRecord,
  IngestionRun,
  IngestionStore,
} from "../src/lib/ingestion.js";
import * as schema from "./schema.js";

export class PostgresRepository implements IngestionStore {
  readonly pool: Pool;
  readonly db: NodePgDatabase<typeof schema>;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
    this.db = drizzle(this.pool, { schema });
  }

  async close() {
    await this.pool.end();
  }

  async listSources(): Promise<SourceConfig[]> {
    const rows = await this.db.select().from(schema.sources);
    return rows.map((row) => ({
      ...row,
      jurisdictionType:
        row.jurisdictionType as SourceConfig["jurisdictionType"],
      publicAccessVerifiedAt: row.publicAccessVerifiedAt?.toISOString() ?? null,
      prebuiltLibraryCheckedAt:
        row.prebuiltLibraryCheckedAt?.toISOString() ?? null,
    }));
  }

  async upsertSources(items: SourceConfig[]) {
    for (const item of items) {
      await this.db
        .insert(schema.sources)
        .values({
          ...item,
          publicAccessVerifiedAt: item.publicAccessVerifiedAt
            ? new Date(item.publicAccessVerifiedAt)
            : null,
          prebuiltLibraryCheckedAt: item.prebuiltLibraryCheckedAt
            ? new Date(item.prebuiltLibraryCheckedAt)
            : null,
        })
        .onConflictDoUpdate({
          target: schema.sources.slug,
          set: {
            name: item.name,
            countryCode: item.countryCode,
            countryName: item.countryName,
            jurisdictionType: item.jurisdictionType,
            jurisdictionName: item.jurisdictionName,
            locale: item.locale,
            timezone: item.timezone,
            currency: item.currency,
            sourceLanguage: item.sourceLanguage,
            sourceUrl: item.sourceUrl,
            inputUrl: item.inputUrl,
            collectorId: item.collectorId,
            adapterKey: item.adapterKey,
            status: item.status,
            requiredFields: item.requiredFields,
            publicAccessVerifiedAt: item.publicAccessVerifiedAt
              ? new Date(item.publicAccessVerifiedAt)
              : null,
            prebuiltLibraryCheckedAt: item.prebuiltLibraryCheckedAt
              ? new Date(item.prebuiltLibraryCheckedAt)
              : null,
          },
        });
    }
  }

  async listOpportunities(): Promise<Opportunity[]> {
    const rows = await this.db
      .select({ canonical: schema.opportunities.canonical })
      .from(schema.opportunities);
    return rows.map((row) => row.canonical as Opportunity);
  }

  async listRuns(): Promise<IngestionRun[]> {
    const rows = await this.db
      .select()
      .from(schema.sourceRuns)
      .orderBy(desc(schema.sourceRuns.startedAt));
    return rows.map((row) => ({
      id: row.id,
      sourceId: row.sourceId,
      collectionId: row.collectionId ?? "",
      status: row.status,
      rowCount: row.rowCount ?? 0,
      validRowCount: row.validRowCount ?? 0,
      metrics: row.metrics as IngestionRun["metrics"],
      problems: row.problems,
      startedAt: row.startedAt.toISOString(),
      finishedAt: (row.finishedAt ?? row.startedAt).toISOString(),
    }));
  }

  async getApplicationWorkspace(opportunityId: string) {
    const [workspace] = await this.db
      .select()
      .from(schema.applicationWorkspaces)
      .where(eq(schema.applicationWorkspaces.opportunityId, opportunityId))
      .limit(1);
    if (!workspace) return null;
    const tasks = await this.db
      .select({
        id: schema.applicationTasks.id,
        label: schema.applicationTasks.label,
        status: schema.applicationTasks.status,
      })
      .from(schema.applicationTasks)
      .where(eq(schema.applicationTasks.workspaceId, workspace.id));
    return { status: workspace.status, notes: workspace.notes ?? "", tasks };
  }

  async saveApplicationWorkspace(
    opportunityId: string,
    input: {
      status:
        | "not_started"
        | "reviewing"
        | "preparing"
        | "ready_for_review"
        | "submitted_manually"
        | "archived";
      notes: string;
      tasks: Array<{ label: string; status: "todo" | "done" | "blocked" }>;
    },
  ) {
    return this.db.transaction(async (tx) => {
      const [workspace] = await tx
        .insert(schema.applicationWorkspaces)
        .values({ opportunityId, status: input.status, notes: input.notes })
        .onConflictDoUpdate({
          target: schema.applicationWorkspaces.opportunityId,
          set: {
            status: input.status,
            notes: input.notes,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.applicationWorkspaces.id });
      await tx
        .delete(schema.applicationTasks)
        .where(eq(schema.applicationTasks.workspaceId, workspace.id));
      const tasks =
        input.tasks.length === 0
          ? []
          : await tx
              .insert(schema.applicationTasks)
              .values(
                input.tasks.map((task) => ({
                  workspaceId: workspace.id,
                  label: task.label,
                  status: task.status,
                  createdBy: "user",
                })),
              )
              .returning({
                id: schema.applicationTasks.id,
                label: schema.applicationTasks.label,
                status: schema.applicationTasks.status,
              });
      return { status: input.status, notes: input.notes, tasks };
    });
  }

  async findRunByCollectionId(
    collectionId: string,
  ): Promise<{ id: string; sourceId: string; startedAt: string } | null> {
    const [row] = await this.db
      .select({
        id: schema.sourceRuns.id,
        sourceId: schema.sourceRuns.sourceId,
        startedAt: schema.sourceRuns.startedAt,
      })
      .from(schema.sourceRuns)
      .where(eq(schema.sourceRuns.collectionId, collectionId))
      .limit(1);
    return row
      ? {
          id: row.id,
          sourceId: row.sourceId,
          startedAt: row.startedAt.toISOString(),
        }
      : null;
  }

  async createRun(
    run: Pick<
      IngestionRun,
      "id" | "sourceId" | "collectionId" | "status" | "startedAt"
    >,
  ) {
    await this.db
      .insert(schema.sourceRuns)
      .values({
        id: run.id,
        sourceId: run.sourceId,
        collectionId: run.collectionId,
        status: run.status,
        startedAt: new Date(run.startedAt),
      });
  }

  async archiveRaw(records: ArchivedRawRecord[]) {
    if (records.length === 0) return;
    await this.db
      .insert(schema.rawRecords)
      .values(
        records.map((record) => ({
          ...record,
          observedAt: new Date(record.observedAt),
        })),
      );
  }

  async finishRun(run: IngestionRun) {
    await this.db
      .update(schema.sourceRuns)
      .set({
        status: run.status,
        rowCount: run.rowCount,
        validRowCount: run.validRowCount,
        metrics: run.metrics,
        problems: run.problems,
        finishedAt: new Date(run.finishedAt),
      })
      .where(eq(schema.sourceRuns.id, run.id));
    const sourceState =
      run.status === "healthy"
        ? "active"
        : run.status === "warning"
          ? "warning"
          : "degraded";
    await this.db
      .update(schema.sources)
      .set({ status: sourceState })
      .where(eq(schema.sources.id, run.sourceId));
  }

  async getCurrentOpportunity(id: string): Promise<Opportunity | null> {
    const [row] = await this.db
      .select({ canonical: schema.opportunities.canonical })
      .from(schema.opportunities)
      .where(eq(schema.opportunities.id, id))
      .limit(1);
    return row ? (row.canonical as Opportunity) : null;
  }

  async publishOpportunity({
    opportunity,
    runId,
    changes,
  }: Parameters<IngestionStore["publishOpportunity"]>[0]) {
    await this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ contentHash: schema.opportunities.contentHash })
        .from(schema.opportunities)
        .where(eq(schema.opportunities.id, opportunity.id))
        .limit(1);
      if (existing?.contentHash === opportunity.contentHash) {
        await tx
          .update(schema.opportunities)
          .set({ lastSeenAt: new Date(opportunity.lastSeenAt) })
          .where(eq(schema.opportunities.id, opportunity.id));
        return;
      }
      const versionId = randomUUID();
      await tx
        .insert(schema.opportunities)
        .values({
          id: opportunity.id,
          sourceId: opportunity.sourceId,
          externalId: opportunity.externalId,
          canonical: opportunity,
          contentHash: opportunity.contentHash,
          currentVersionId: null,
          firstSeenAt: new Date(opportunity.firstSeenAt),
          lastSeenAt: new Date(opportunity.lastSeenAt),
        })
        .onConflictDoNothing();
      await tx
        .insert(schema.opportunityVersions)
        .values({
          id: versionId,
          opportunityId: opportunity.id,
          sourceRunId: runId,
          canonical: opportunity,
          contentHash: opportunity.contentHash,
          observedAt: new Date(opportunity.collectedAt),
        });
      await tx
        .update(schema.opportunities)
        .set({
          canonical: opportunity,
          contentHash: opportunity.contentHash,
          currentVersionId: versionId,
          lastSeenAt: new Date(opportunity.lastSeenAt),
        })
        .where(eq(schema.opportunities.id, opportunity.id));
      if (changes.length > 0)
        await tx
          .insert(schema.opportunityChanges)
          .values(
            changes.map((change) => ({
              opportunityId: opportunity.id,
              versionId,
              fieldName: change.field,
              oldValue: change.oldValue,
              newValue: change.newValue,
              severity: change.severity,
              observedAt: new Date(change.observedAt),
            })),
          );
      if (opportunity.evidence.length > 0)
        await tx
          .insert(schema.fieldEvidence)
          .values(
            opportunity.evidence.map((item) => ({
              id: randomUUID(),
              opportunityId: opportunity.id,
              versionId,
              fieldName: item.fieldName,
              normalizedValue: item.normalizedValue,
              rawLabel: item.rawLabel,
              rawValue: item.rawValue,
              sourceUrl: item.sourceUrl,
              observedAt: new Date(item.observedAt),
              confidence: item.confidence,
            })),
          );
    });
  }
}
