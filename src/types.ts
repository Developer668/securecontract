export type SourceHealth = 'healthy' | 'warning' | 'degraded' | 'healing_proposed' | 'disabled';
export type OpportunityStatus = 'open' | 'closed' | 'awarded' | 'cancelled' | 'planned' | 'unknown';
export type ProcedureType = 'request_for_proposal' | 'request_for_tender' | 'request_for_quote' | 'request_for_information' | 'expression_of_interest' | 'invitation_to_tender' | 'framework' | 'other';

export interface SourceConfig {
  id: string; slug: string; name: string; countryCode: string; countryName: string;
  jurisdictionType: 'national' | 'state' | 'province' | 'region' | 'county' | 'municipality' | 'agency' | 'other';
  jurisdictionName: string | null; locale: string; timezone: string; currency: string | null;
  sourceLanguage: string; sourceUrl: string; inputUrl: string; collectorId: string | null;
  adapterKey: string; status: 'draft' | 'active' | 'warning' | 'degraded' | 'disabled';
  requiredFields: string[]; publicAccessVerifiedAt: string | null; prebuiltLibraryCheckedAt: string | null;
  publishToOpportunityFeed?: boolean;
  collectionMethod?: 'bright_data' | 'public_html';
}

export interface FieldEvidence {
  id: string; opportunityId: string; versionId: string; fieldName: string; normalizedValue: unknown;
  rawLabel: string | null; rawValue: string | null; sourceUrl: string; observedAt: string;
  confidence: 'high' | 'medium' | 'low' | 'conflicting';
}

export interface OpportunityChange { id: string; field: string; oldValue: unknown; newValue: unknown; severity: 'low' | 'medium' | 'high' | 'critical'; observedAt: string; }

export interface Opportunity {
  id: string; sourceId: string; externalId: string | null; opportunityKind: 'contract';
  countryCode: string; countryName: string; jurisdiction: string | null; buyerOriginal: string; buyerNormalized: string | null;
  titleOriginal: string; titleEnglish: string | null; descriptionOriginal: string | null; descriptionEnglish: string | null;
  sourceLanguage: string; status: OpportunityStatus; procedureTypeOriginal: string | null; procedureType: ProcedureType;
  industryCodes: Array<{ system: 'NAICS' | 'UNSPSC' | 'CPV' | 'OTHER'; code: string; label: string | null }>;
  currency: string | null; estimatedValueMinor: string | null; publishedAt: string | null; questionsDueAt: string | null;
  submissionDueAt: string | null; bidOpeningAt: string | null; prebidMeetingAt: string | null; localTimezone: string;
  domesticOnly: boolean | null; registrationRequired: boolean | null; eligibilitySummary: string | null; sourceUrl: string;
  detailUrl: string | null; documents: unknown[]; amendments: unknown[]; collectedAt: string; firstSeenAt: string; lastSeenAt: string;
  contentHash: string; verification: 'verified' | 'partial' | 'last_known_good'; sourceHealth: SourceHealth;
  evidence: FieldEvidence[]; changes: OpportunityChange[]; raw: Record<string, unknown>;
}
