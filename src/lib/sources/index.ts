import { z } from "zod";
import type { Opportunity, SourceConfig } from "../../types.js";
import {
  normalizeProcedure,
  normalizeStatus,
  parseLocalDate,
  statusAtDeadline,
  stableHash,
} from "../normalization.js";

export interface SourceContext {
  source: SourceConfig;
  collectedAt: string;
}
export interface NormalizedOpportunityResult {
  opportunity: Opportunity;
  warnings: string[];
}
export interface SourceAdapter {
  rawSchema: z.ZodType;
  expandRows?(rows: Record<string, unknown>[]): Record<string, unknown>[];
  normalize(raw: unknown, context: SourceContext): NormalizedOpportunityResult;
}

const simpleRawSchema = z
  .object({
    title: z.string().min(1),
    detail_url: z.string().url(),
    external_id: z.string().optional(),
    buyer: z.string().optional(),
    status_raw: z.string().optional(),
    procedure_type_raw: z.string().optional(),
    closing_date_iso: z.string().datetime({ offset: true }).optional(),
  })
  .passthrough();

function normalizeSimple(
  input: unknown,
  context: SourceContext,
): NormalizedOpportunityResult {
  const raw = simpleRawSchema.parse(input);
  const internalKey = `${context.source.id}:${raw.external_id ?? raw.detail_url}`;
  const submissionDueAt = raw.closing_date_iso ?? null;
  const base = {
    id: internalKey,
    sourceId: context.source.id,
    externalId: raw.external_id ?? null,
    opportunityKind: "contract" as const,
    countryCode: context.source.countryCode,
    countryName: context.source.countryName,
    jurisdiction: context.source.jurisdictionName,
    buyerOriginal: raw.buyer ?? "Not provided by source",
    buyerNormalized: null,
    titleOriginal: raw.title,
    titleEnglish: null,
    descriptionOriginal: null,
    descriptionEnglish: null,
    sourceLanguage: context.source.sourceLanguage,
    status: statusAtDeadline(normalizeStatus(raw.status_raw), submissionDueAt, context.collectedAt),
    procedureTypeOriginal: raw.procedure_type_raw ?? null,
    procedureType: normalizeProcedure(raw.procedure_type_raw),
    industryCodes: [],
    currency: context.source.currency,
    estimatedValueMinor: null,
    publishedAt: null,
    questionsDueAt: null,
    submissionDueAt,
    bidOpeningAt: null,
    prebidMeetingAt: null,
    localTimezone: context.source.timezone,
    domesticOnly: null,
    registrationRequired: null,
    eligibilitySummary: null,
    sourceUrl: context.source.sourceUrl,
    detailUrl: raw.detail_url,
    documents: [],
    amendments: [],
    collectedAt: context.collectedAt,
    firstSeenAt: context.collectedAt,
    lastSeenAt: context.collectedAt,
    contentHash: "",
    verification: "partial" as const,
    sourceHealth: "warning" as const,
    evidence: [],
    changes: [],
    raw,
  } as Opportunity;
  const evidenceFields: Array<
    [string, unknown, string, string | undefined, "high" | "medium"]
  > = [
    ["externalId", base.externalId, "external_id", raw.external_id, "high"],
    ["titleOriginal", base.titleOriginal, "title", raw.title, "high"],
    ["buyerOriginal", base.buyerOriginal, "buyer", raw.buyer, "high"],
    ["status", base.status, "status_raw", raw.status_raw, "medium"],
    [
      "procedureType",
      base.procedureType,
      "procedure_type_raw",
      raw.procedure_type_raw,
      "medium",
    ],
    [
      "submissionDueAt",
      base.submissionDueAt,
      "closing_date_iso",
      raw.closing_date_iso,
      "high",
    ],
  ];
  base.evidence = evidenceFields
    .filter(
      ([, normalizedValue, , rawValue]) =>
        normalizedValue !== null && rawValue !== undefined,
    )
    .map(
      (
        [fieldName, normalizedValue, rawLabel, rawValue, confidence],
        index,
      ) => ({
        id: `pending-${index}`,
        opportunityId: internalKey,
        versionId: "pending",
        fieldName,
        normalizedValue,
        rawLabel,
        rawValue: rawValue ?? null,
        sourceUrl: raw.detail_url,
        observedAt: context.collectedAt,
        confidence,
      }),
    );
  const opportunity = {
    ...base,
    contentHash: stableHash(base as unknown as Record<string, unknown>),
  } as Opportunity;
  return {
    opportunity,
    warnings: raw.buyer ? [] : ["Buyer was not present in source row"],
  };
}

const listingRawSchema = z
  .object({
    title: z.string().optional(),
    project_title: z.string().optional(),
    tender_title: z.string().optional(),
    procurement_title: z.string().optional(),
    publication_title: z.string().optional(),
    project_id: z.string().optional(),
    tender_id: z.string().optional(),
    e_bid_no: z.string().optional(),
    solicitation_id: z.string().optional(),
    detail_url: z.string().url().optional(),
    source_url: z.string().url().optional(),
    product_page_url: z.string().url().optional(),
    document_url: z.string().url().optional(),
    buyer: z.string().optional(),
    issued_by: z.string().optional(),
    organization: z.string().optional(),
    department: z.string().optional(),
    status_raw: z.string().optional(),
    tender_type_raw: z.string().optional(),
    bid_type_raw: z.string().optional(),
    procedure_type_raw: z.string().optional(),
    publication_category: z.string().optional(),
    due_date_raw: z.string().optional(),
    closing_date_raw: z.string().optional(),
    bid_closing_date_raw: z.string().optional(),
    last_sale_date_raw: z.string().optional(),
    release_date_raw: z.string().optional(),
    open_date_raw: z.string().optional(),
    published_date_raw: z.string().optional(),
    document_upload_date_raw: z.string().optional(),
    bid_opening_date_raw: z.string().optional(),
    brief_description: z.string().optional(),
    description: z.string().optional(),
    document_urls: z.array(z.string().url()).optional(),
    corrigendum_urls: z.array(z.string().url()).optional(),
  })
  .passthrough()
  .superRefine((raw, ctx) => {
    if (
      !(
        raw.title ||
        raw.project_title ||
        raw.tender_title ||
        raw.procurement_title ||
        raw.publication_title
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "A visible opportunity title is required",
      });
    if (
      !(raw.detail_url || raw.source_url || raw.product_page_url || raw.document_url)
    )
      ctx.addIssue({
        code: "custom",
        message: "An official source URL is required",
      });
  });

function normalizeListing(
  input: unknown,
  context: SourceContext,
): NormalizedOpportunityResult {
  const raw = listingRawSchema.parse(input);
  const title =
    raw.title ??
    raw.project_title ??
    raw.tender_title ??
    raw.procurement_title ??
    raw.publication_title!;
  const externalId =
    raw.project_id ??
    raw.tender_id ??
    raw.e_bid_no ??
    raw.solicitation_id ??
    null;
  const detailUrl = raw.detail_url ?? raw.document_url ?? raw.source_url ?? raw.product_page_url!;
  const buyer =
    raw.buyer ??
    raw.issued_by ??
    raw.organization ??
    raw.department ??
    "Not provided by source";
  const statusRaw = raw.status_raw;
  const procedureRaw =
    raw.procedure_type_raw ?? raw.tender_type_raw ?? raw.bid_type_raw ?? raw.publication_category;
  const submissionRaw =
    raw.due_date_raw ??
    raw.closing_date_raw ??
    raw.bid_closing_date_raw ??
    raw.last_sale_date_raw;
  const submissionDueAt = submissionRaw
    ? parseLocalDate(submissionRaw, context.source.timezone)
    : null;
  const publishedRaw =
    raw.release_date_raw ?? raw.open_date_raw ?? raw.published_date_raw ?? raw.document_upload_date_raw;
  const bidOpeningRaw = raw.bid_opening_date_raw;
  const internalKey = `${context.source.id}:${externalId ?? detailUrl}`;
  const base = {
    id: internalKey,
    sourceId: context.source.id,
    externalId,
    opportunityKind: "contract" as const,
    countryCode: context.source.countryCode,
    countryName: context.source.countryName,
    jurisdiction: context.source.jurisdictionName,
    buyerOriginal: buyer,
    buyerNormalized: null,
    titleOriginal: title,
    titleEnglish: null,
    descriptionOriginal: raw.brief_description ?? raw.description ?? null,
    descriptionEnglish: null,
    sourceLanguage: context.source.sourceLanguage,
    status: statusAtDeadline(normalizeStatus(statusRaw), submissionDueAt, context.collectedAt),
    procedureTypeOriginal: procedureRaw ?? null,
    procedureType: normalizeProcedure(procedureRaw),
    industryCodes: [],
    currency: context.source.currency,
    estimatedValueMinor: null,
    publishedAt: publishedRaw
      ? parseLocalDate(publishedRaw, context.source.timezone)
      : null,
    questionsDueAt: null,
    submissionDueAt,
    bidOpeningAt: bidOpeningRaw
      ? parseLocalDate(bidOpeningRaw, context.source.timezone)
      : null,
    prebidMeetingAt: null,
    localTimezone: context.source.timezone,
    domesticOnly: null,
    registrationRequired: null,
    eligibilitySummary: null,
    sourceUrl: context.source.sourceUrl,
    detailUrl,
    documents: (raw.document_urls ?? []).map((url) => ({
      name: "Public procurement document",
      url,
    })),
    amendments: (raw.corrigendum_urls ?? []).map((url) => ({
      label: "Corrigendum",
      url,
    })),
    collectedAt: context.collectedAt,
    firstSeenAt: context.collectedAt,
    lastSeenAt: context.collectedAt,
    contentHash: "",
    verification: "partial" as const,
    sourceHealth: "warning" as const,
    evidence: [],
    changes: [],
    raw: raw as Record<string, unknown>,
  } as Opportunity;
  const evidenceRows: Array<
    [string, unknown, string, string | undefined, "high" | "medium"]
  > = [
    [
      "externalId",
      externalId,
      raw.project_id
        ? "project_id"
        : raw.tender_id
          ? "tender_id"
          : raw.e_bid_no
            ? "e_bid_no"
            : "solicitation_id",
      externalId ?? undefined,
      "high",
    ],
    [
      "titleOriginal",
      title,
      raw.project_title
        ? "project_title"
        : raw.tender_title
          ? "tender_title"
          : raw.procurement_title
            ? "procurement_title"
            : raw.publication_title
              ? "publication_title"
              : "title",
      title,
      "high",
    ],
    [
      "buyerOriginal",
      buyer,
      raw.buyer
        ? "buyer"
        : raw.issued_by
          ? "issued_by"
          : raw.organization
            ? "organization"
            : "department",
      buyer === "Not provided by source" ? undefined : buyer,
      "high",
    ],
    ["status", base.status, "status_raw", statusRaw, "high"],
    [
      "procedureType",
      base.procedureType,
      raw.procedure_type_raw
        ? "procedure_type_raw"
        : raw.tender_type_raw
          ? "tender_type_raw"
          : "bid_type_raw",
      procedureRaw,
      "medium",
    ],
    [
      "submissionDueAt",
      base.submissionDueAt,
      raw.due_date_raw
        ? "due_date_raw"
        : raw.closing_date_raw
          ? "closing_date_raw"
          : raw.bid_closing_date_raw
            ? "bid_closing_date_raw"
            : "last_sale_date_raw",
      submissionRaw,
      "high",
    ],
    [
      "bidOpeningAt",
      base.bidOpeningAt,
      "bid_opening_date_raw",
      bidOpeningRaw,
      "high",
    ],
  ];
  base.evidence = evidenceRows
    .filter(([, value, , rawValue]) => value !== null && rawValue !== undefined)
    .map(
      (
        [fieldName, normalizedValue, rawLabel, rawValue, confidence],
        index,
      ) => ({
        id: `pending-${index}`,
        opportunityId: internalKey,
        versionId: "pending",
        fieldName,
        normalizedValue,
        rawLabel,
        rawValue: rawValue ?? null,
        sourceUrl: detailUrl,
        observedAt: context.collectedAt,
        confidence,
      }),
    );
  const warnings = [] as string[];
  if (buyer === "Not provided by source")
    warnings.push("Buyer was not present in source row");
  if (submissionRaw && !base.submissionDueAt)
    warnings.push(`Could not parse submission date: ${submissionRaw}`);
  const opportunity = {
    ...base,
    contentHash: stableHash(base as unknown as Record<string, unknown>),
  } as Opportunity;
  return { opportunity, warnings };
}

export const declarativeAdapter: SourceAdapter = {
  rawSchema: simpleRawSchema,
  normalize: normalizeSimple,
};
export const procurementListingAdapter: SourceAdapter = {
  rawSchema: listingRawSchema,
  expandRows: (rows) =>
    rows.flatMap((row) => {
      if (!Array.isArray(row.opportunities)) return [row];
      return row.opportunities.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item),
      );
    }),
  normalize: normalizeListing,
};
export const sourceAdapters: Record<string, SourceAdapter> = {
  declarative: declarativeAdapter,
  "procurement-listing": procurementListingAdapter,
  "india-aai-tenders": procurementListingAdapter,
  "india-aai-publications": procurementListingAdapter,
  "india-aai-search": procurementListingAdapter,
  "australia-asl-tenders": procurementListingAdapter,
  "california-orange-opengov": procurementListingAdapter,
  "california-cca-procurement": procurementListingAdapter,
  "canada-canadabuys": procurementListingAdapter,
  "us-chicago-solicitations": procurementListingAdapter,
};
export function adapterFor(key: string) {
  return sourceAdapters[key] ?? declarativeAdapter;
}
