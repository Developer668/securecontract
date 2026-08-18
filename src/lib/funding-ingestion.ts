import { createHash } from 'node:crypto';
import type { EvidencePassage, FundingOpportunity, FundingSource } from '../types.js';

const first = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
};

const parseMoney = (value: string | null) => {
  if (!value) return null;
  const numeric = Number(value.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? Math.round(numeric) : null;
};

const parseDeadline = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export function normalizeFundingRows(
  source: FundingSource,
  rows: unknown[],
  observedAt = new Date().toISOString(),
): FundingOpportunity[] {
  return rows.flatMap((unknownRow, index) => {
    if (!unknownRow || typeof unknownRow !== 'object' || Array.isArray(unknownRow)) return [];
    const row = unknownRow as Record<string, unknown>;
    const title = first(row, ['title', 'opportunity_title', 'name', 'program_name']);
    const detailUrl = first(row, ['detail_url', 'url', 'source_url', 'opportunity_url']);
    if (!title || !detailUrl) return [];
    const deadlineText = first(row, ['deadline', 'deadline_raw', 'due_date', 'closing_date']) ?? 'Not stated';
    const deadline = parseDeadline(deadlineText);
    const eligibility = first(row, ['eligibility', 'eligible_applicants', 'who_can_apply']);
    const amountText = first(row, ['amount', 'award_amount', 'funding_amount', 'budget']) ?? 'Not stated';
    const summary = first(row, ['summary', 'description', 'purpose']) ?? 'No summary was collected.';
    const externalId = first(row, ['external_id', 'notice_id', 'opportunity_number']) ?? `${index}`;
    const id = `bright-${createHash('sha256').update(`${source.id}:${externalId}:${title}`).digest('hex').slice(0, 18)}`;
    const evidence: EvidencePassage[] = [
      { id:`${id}-title`, field:'title', passage:title, sourceUrl:detailUrl, observedAt, confidence:'high' },
      ...(deadlineText !== 'Not stated' ? [{ id:`${id}-deadline`, field:'deadline', passage:deadlineText, sourceUrl:detailUrl, observedAt, confidence:'high' as const }] : []),
      ...(eligibility ? [{ id:`${id}-eligibility`, field:'eligibility', passage:eligibility, sourceUrl:detailUrl, observedAt, confidence:'medium' as const }] : []),
    ];
    const amount = parseMoney(amountText);
    const deadlineState = deadline && new Date(deadline).getTime() < Date.now() ? 'closed' : deadline ? 'open' : 'watching';
    return [{
      id, sourceId:source.id, title, funder:source.organization, program:source.name, category:source.category,
      researchAreas:[], summary, amountMin:amount, amountMax:amount, amountText, currency:'USD' as const,
      deadline, deadlineText, status:deadlineState as FundingOpportunity['status'], geography:'US' as const,
      careerStages:[], institutionTypes:[], requiredPartners:[], commercializationStages:[], sourceUrl:source.sourceUrl,
      detailUrl, observedAt, changedAt:null, sourceHealth:'healthy' as const, provenance:'bright_data_live' as const,
      match:{
        eligibility:'insufficient_evidence' as const,
        score: eligibility ? 50 : 35,
        explanation:'A live Bright Data record was collected. Lab-specific eligibility remains insufficient until explicit requirements are matched.',
        relevantCapabilities:[],
        missingInformation:[...(eligibility ? [] : ['Eligibility passage']), ...(deadline ? [] : ['Deadline'])],
        requirements:[{id:`${id}-req`,label:'Explicit applicant eligibility',state:eligibility?'unknown':'unknown',evidenceId:eligibility?`${id}-eligibility`:null}],
      },
      evidence,
      tasks:[{id:`${id}-task`,title:'Review the official opportunity and confirm eligibility',dueAt:deadline,status:'todo' as const}],
    }];
  });
}
