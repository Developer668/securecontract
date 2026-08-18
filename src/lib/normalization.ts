import { createHash } from 'node:crypto';
import { isValid, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { Opportunity, OpportunityChange, OpportunityStatus, ProcedureType } from '../types.js';

export function normalizeStatus(value: string | null | undefined): OpportunityStatus {
  const text = value?.trim().toLowerCase() ?? '';
  if (/cancel|withdraw|terminated/.test(text)) return 'cancelled';
  if (/award/.test(text)) return 'awarded';
  if (/closed|expired/.test(text)) return 'closed';
  if (/planned|forecast/.test(text)) return 'planned';
  if (/open|active|published/.test(text)) return 'open';
  return 'unknown';
}

export function statusAtDeadline(
  status: OpportunityStatus,
  submissionDueAt: string | null,
  asOf: string = new Date().toISOString(),
): OpportunityStatus {
  if (status === 'cancelled' || status === 'awarded' || status === 'closed') return status;
  if (!submissionDueAt) return status;
  const deadline = Date.parse(submissionDueAt);
  const observed = Date.parse(asOf);
  return Number.isFinite(deadline) && Number.isFinite(observed) && deadline <= observed
    ? 'closed'
    : status;
}

export function closeExpiredOpportunity(
  opportunity: Opportunity,
  asOf: string = new Date().toISOString(),
): Opportunity {
  const status = statusAtDeadline(opportunity.status, opportunity.submissionDueAt, asOf);
  if (status === opportunity.status) return opportunity;
  const alreadyRecorded = opportunity.changes.some(
    (change) => change.field === 'status' && change.newValue === 'closed',
  );
  const updated: Opportunity = {
    ...opportunity,
    status,
    changes: alreadyRecorded
      ? opportunity.changes
      : [
          ...opportunity.changes,
          {
            id: `deadline-closed-${opportunity.id}`,
            field: 'status',
            oldValue: opportunity.status,
            newValue: 'closed',
            severity: 'low',
            observedAt: opportunity.submissionDueAt ?? asOf,
          },
        ],
  };
  updated.contentHash = stableHash(updated as unknown as Record<string, unknown>);
  return updated;
}

export function normalizeProcedure(value: string | null | undefined): ProcedureType {
  const text = value?.trim().toLowerCase() ?? '';
  if (/request for proposal|\brfp\b/.test(text)) return 'request_for_proposal';
  if (/request for quote|quotation|\brfq\b/.test(text)) return 'request_for_quote';
  if (/request for information|\brfi\b/.test(text)) return 'request_for_information';
  if (/expression of interest|\beoi\b/.test(text)) return 'expression_of_interest';
  if (/invitation to tender/.test(text)) return 'invitation_to_tender';
  if (/request for tender|open tender|\brft\b/.test(text)) return 'request_for_tender';
  if (/framework/.test(text)) return 'framework';
  return 'other';
}

export function parseLocalDate(value: string, timezone: string): string | null {
  const normalized = value.trim().replace(/\b(IST|AEST|AEDT|PDT|PST|UTC|GMT)\b/gi, '').replace(/\s*\|\s*/g, ' ').replace(/(\d)(am|pm)\b/gi, '$1 $2').replace(/\s+/g, ' ').trim();
  const leadingDate = normalized.match(
    /^\d{1,2} [A-Za-z]{3,9} \d{4}(?: \d{1,2}(?::\d{2})? ?(?:am|pm))?/i,
  )?.[0];
  const candidates = leadingDate && leadingDate !== normalized
    ? [normalized, leadingDate]
    : [normalized];
  const formats = [
    "yyyy-MM-dd'T'HH:mm:ssXXX", "yyyy-MM-dd'T'HH:mm:ss.SSS", "yyyy-MM-dd'T'HH:mm:ss", 'yyyy-MM-dd HH:mm:ss',
    'dd-MMM-yyyy HH:mm', 'dd-MMM-yyyy hh:mm a', 'dd MMM yyyy HH:mm', 'dd MMM yyyy h:mm a', 'dd MMM yyyy h a', 'dd-MM-yyyy HH:mm', 'dd/MM/yyyy HH:mm',
    'MM/dd/yyyy h:mm a', 'd MMMM yyyy h:mm a', 'd MMMM yyyy H:mm',
    'dd-MMM-yyyy', 'dd MMM yyyy', 'dd-MM-yyyy', 'MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'yyyy/MM/dd',
  ];
  for (const candidate of candidates) {
    for (const format of formats) {
      const parsed = parse(candidate, format, new Date(0));
      if (!isValid(parsed)) continue;
      if (format.endsWith('XXX')) return parsed.toISOString();
      return fromZonedTime(parsed, timezone).toISOString();
    }
  }
  return null;
}

const volatile = new Set(['collectedAt', 'firstSeenAt', 'lastSeenAt', 'contentHash', 'verification', 'sourceHealth', 'evidence', 'changes', 'raw']);
export function stableHash(value: Record<string, unknown>): string {
  const stable = Object.fromEntries(Object.entries(value).filter(([key]) => !volatile.has(key)).sort(([a],[b]) => a.localeCompare(b)));
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex');
}

export function classifySeverity(field: string, oldValue: unknown, newValue: unknown): OpportunityChange['severity'] {
  void oldValue; void newValue;
  if (['submissionDueAt','prebidMeetingAt','eligibilitySummary'].includes(field)) return 'critical';
  if (field === 'status' && newValue === 'cancelled') return 'critical';
  if (['questionsDueAt','amendments'].includes(field)) return 'high';
  if (['documents','procedureType','industryCodes'].includes(field)) return 'medium';
  return 'low';
}

export function diffOpportunity(before: Opportunity, after: Opportunity): OpportunityChange[] {
  const ignored = new Set(['collectedAt','lastSeenAt','contentHash','evidence','changes','raw']);
  return Object.keys(after).filter((field) => !ignored.has(field) && JSON.stringify(before[field as keyof Opportunity]) !== JSON.stringify(after[field as keyof Opportunity])).map((field, index) => ({
    id:`change-${Date.now()}-${index}`, field, oldValue:before[field as keyof Opportunity], newValue:after[field as keyof Opportunity],
    severity:classifySeverity(field,before[field as keyof Opportunity],after[field as keyof Opportunity]), observedAt:after.collectedAt,
  }));
}
