import { createHash, randomUUID } from 'node:crypto';
import type { Opportunity, OpportunityChange, SourceConfig } from '../types.js';
import { diffOpportunity, parseLocalDate } from './normalization.js';
import { adapterFor } from './sources/index.js';
import { validateRun, type RunMetrics, type RunValidation } from './validation.js';

export type ArchivedRawRecord = {
  id: string;
  sourceRunId: string;
  sourceId: string;
  recordIndex: number;
  raw: Record<string, unknown>;
  rawHash: string;
  observedAt: string;
};

export type IngestionRun = {
  id: string;
  sourceId: string;
  collectionId: string;
  status: 'pending' | 'healthy' | 'warning' | 'degraded' | 'failed';
  rowCount: number;
  validRowCount: number;
  metrics: RunMetrics;
  problems: string[];
  startedAt: string;
  finishedAt: string;
};

export interface IngestionStore {
  createRun(run: Pick<IngestionRun, 'id' | 'sourceId' | 'collectionId' | 'status' | 'startedAt'>): Promise<void>;
  archiveRaw(records: ArchivedRawRecord[]): Promise<void>;
  finishRun(run: IngestionRun): Promise<void>;
  getCurrentOpportunity(id: string): Promise<Opportunity | null>;
  publishOpportunity(input: { opportunity: Opportunity; runId: string; changes: OpportunityChange[] }): Promise<void>;
}

export type IngestResult = {
  run: IngestionRun;
  validation: RunValidation;
  published: Opportunity[];
  preservedLastKnownGood: boolean;
};

function objectRows(rows: unknown[]): Record<string, unknown>[] {
  return rows.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object' && !Array.isArray(row));
}

function metricsFor(rows: Record<string, unknown>[], source: SourceConfig, baselineRowCount: number | null): RunMetrics {
  const requiredSlots = rows.length * source.requiredFields.length;
  const populated = rows.reduce((sum, row) => sum + source.requiredFields.filter((field) => {
    const value = row[field];
    return value !== null && value !== undefined && String(value).trim().length > 0;
  }).length, 0);
  const dateValues = rows.flatMap((row) => Object.entries(row).filter(([key, value]) => /date|deadline|closing|opening/i.test(key) && typeof value === 'string' && !/^(?:n\/?a|not available|none|-)?$/i.test(value.trim())).map(([, value]) => value as string));
  const parseableDates = dateValues.filter((value) => parseLocalDate(value, source.timezone) !== null).length;
  const identity = (row: Record<string, unknown>) => String(row.external_id ?? row.reference_number ?? row.rfx_number ?? row.solicitation_id ?? row.detail_url ?? row.document_url ?? JSON.stringify(row));
  const unique = new Set(rows.map(identity)).size;
  const text = JSON.stringify(rows.slice(0, 10)).toLowerCase();
  return {
    rowCount: rows.length,
    baselineRowCount,
    requiredFieldCompleteness: requiredSlots === 0 ? 0 : populated / requiredSlots,
    dateParseRate: dateValues.length === 0 ? 1 : parseableDates / dateValues.length,
    duplicateRate: rows.length === 0 ? 0 : 1 - unique / rows.length,
    schemaStability: source.requiredFields.length === 0 ? 1 : Math.min(1, populated / Math.max(1, requiredSlots)),
    freshness: 1,
    accessWallDetected: /sign[ -]?in required|login required|access denied|captcha required/.test(text),
  };
}

export async function ingestRows(input: {
  source: SourceConfig;
  collectionId: string;
  rows: unknown[];
  store: IngestionStore;
  baselineRowCount?: number | null;
  observedAt?: string;
  runId?: string;
  runAlreadyCreated?: boolean;
  publish?: boolean;
}): Promise<IngestResult> {
  const observedAt = input.observedAt ?? new Date().toISOString();
  const runId = input.runId ?? randomUUID();
  if (!input.runAlreadyCreated) await input.store.createRun({ id: runId, sourceId: input.source.id, collectionId: input.collectionId, status: 'pending', startedAt: observedAt });

  // Archive first: even rejected extraction is evidence and must remain inspectable.
  const rows = objectRows(input.rows);
  await input.store.archiveRaw(rows.map((raw, recordIndex) => ({
    id: randomUUID(), sourceRunId: runId, sourceId: input.source.id, recordIndex, raw,
    rawHash: createHash('sha256').update(JSON.stringify(raw)).digest('hex'), observedAt,
  })));

  const adapter = adapterFor(input.source.adapterKey);
  const normalizationRows = adapter.expandRows?.(rows) ?? rows;
  const metrics = metricsFor(normalizationRows, input.source, input.baselineRowCount ?? null);
  const validation = validateRun(metrics);
  const normalized: Opportunity[] = [];
  if (validation.accepted) {
    for (const raw of normalizationRows) {
      const parsed = adapter.rawSchema.safeParse(raw);
      if (parsed.success) normalized.push(adapter.normalize(parsed.data, { source: input.source, collectedAt: observedAt }).opportunity);
    }
  }
  const effectiveValidation = validation.accepted && normalized.length === 0
    ? { accepted: false, health: 'degraded' as const, score: Math.min(validation.score, 49), problems: [...validation.problems, 'No rows passed the source adapter contract'] }
    : validation;
  const status = effectiveValidation.accepted ? effectiveValidation.health : 'degraded';
  const run: IngestionRun = { id: runId, sourceId: input.source.id, collectionId: input.collectionId, status, rowCount: normalizationRows.length, validRowCount: normalized.length, metrics, problems: effectiveValidation.problems, startedAt: observedAt, finishedAt: new Date().toISOString() };
  await input.store.finishRun(run);

  if (!effectiveValidation.accepted) return { run, validation: effectiveValidation, published: [], preservedLastKnownGood: true };
  if (input.publish === false) {
    return { run, validation: effectiveValidation, published: [], preservedLastKnownGood: false };
  }
  for (const opportunity of normalized) {
    opportunity.sourceHealth=effectiveValidation.health;
    opportunity.verification=opportunity.evidence.length>=3?'verified':'partial';
    const current = await input.store.getCurrentOpportunity(opportunity.id);
    const changes = current ? diffOpportunity(current, opportunity) : [];
    await input.store.publishOpportunity({ opportunity, runId, changes });
  }
  return { run, validation: effectiveValidation, published: normalized, preservedLastKnownGood: false };
}

export class MemoryIngestionStore implements IngestionStore {
  runs: IngestionRun[] = [];
  rawRecords: ArchivedRawRecord[] = [];
  opportunities = new Map<string, Opportunity>();
  changes: OpportunityChange[] = [];
  versions = new Map<string, Opportunity[]>();
  async createRun(run: Pick<IngestionRun, 'id' | 'sourceId' | 'collectionId' | 'status' | 'startedAt'>) {
    this.runs.push({ ...run, rowCount: 0, validRowCount: 0, metrics: metricsFor([], { requiredFields: [] } as unknown as SourceConfig, null), problems: [], finishedAt: run.startedAt });
  }
  async archiveRaw(records: ArchivedRawRecord[]) { this.rawRecords.push(...records); }
  async finishRun(run: IngestionRun) { const index = this.runs.findIndex((item) => item.id === run.id); this.runs[index] = run; }
  async getCurrentOpportunity(id: string) { return this.opportunities.get(id) ?? null; }
  async publishOpportunity({ opportunity, changes }: { opportunity: Opportunity; runId: string; changes: OpportunityChange[] }) {
    const current=this.opportunities.get(opportunity.id);
    if(current?.contentHash===opportunity.contentHash){this.opportunities.set(opportunity.id,{...current,lastSeenAt:opportunity.lastSeenAt});return;}
    this.opportunities.set(opportunity.id, opportunity);
    this.versions.set(opportunity.id,[...(this.versions.get(opportunity.id)??[]),opportunity]);
    this.changes.push(...changes);
  }
}
