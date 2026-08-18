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
  collectionMethod?: 'bright_data';
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

export type FundingEligibility =
  | 'verified_eligible'
  | 'likely_confirmation_required'
  | 'insufficient_evidence'
  | 'not_eligible';

export type FundingCategory =
  | 'federal'
  | 'foundation'
  | 'scientific_society'
  | 'corporate_challenge'
  | 'accelerator'
  | 'equipment_access'
  | 'compute_credit';

export interface EvidencePassage {
  id: string;
  field: string;
  passage: string;
  sourceUrl: string;
  observedAt: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface FundingRequirement {
  id: string;
  label: string;
  state: 'met' | 'unknown' | 'unmet';
  evidenceId: string | null;
}

export interface FundingMatch {
  status?: 'pending' | 'ai_scored' | 'fallback';
  model?: string | null;
  scoredAt?: string | null;
  eligibility: FundingEligibility;
  score: number;
  explanation: string;
  relevantCapabilities: string[];
  missingInformation: string[];
  requirements: FundingRequirement[];
}

export interface FundingOpportunity {
  id: string;
  sourceId: string;
  title: string;
  funder: string;
  program: string;
  category: FundingCategory;
  researchAreas: string[];
  summary: string;
  amountMin: number | null;
  amountMax: number | null;
  amountText: string;
  currency: 'USD';
  deadline: string | null;
  deadlineText: string;
  status: 'open' | 'rolling' | 'closing_soon' | 'closed' | 'watching';
  geography: 'US';
  careerStages: string[];
  institutionTypes: string[];
  requiredPartners: string[];
  commercializationStages: string[];
  sourceUrl: string;
  detailUrl: string;
  observedAt: string;
  changedAt: string | null;
  sourceHealth: 'healthy' | 'warning' | 'draft';
  match: FundingMatch;
  evidence: EvidencePassage[];
  tasks: Array<{ id: string; title: string; dueAt: string | null; status: 'todo' | 'done' }>;
  provenance: 'recorded_demo' | 'bright_data_live';
  raw?: Record<string, unknown>;
}

export interface LabProfile {
  name: string;
  institution: string;
  country: 'US';
  researchAreas: string[];
  methods: string[];
  careerStages: string[];
  equipment: string[];
  previousWork: string[];
  desiredFundingMin: number | null;
  desiredFundingMax: number | null;
  collaborationPreferences: string[];
  commercializationStage: string;
  updatedAt: string;
}

export interface FundingSource {
  id: string;
  name: string;
  organization: string;
  category: FundingCategory;
  sourceUrl: string;
  inputUrl: string;
  collectorId: string | null;
  status: 'active' | 'warning' | 'draft';
  requiredFields: string[];
  lastRunAt: string | null;
  lastRunStatus: 'healthy' | 'degraded' | 'pending' | null;
  recordCount: number;
  schedule: string;
  collectionMethod: 'bright_data';
}

export interface FundingEvent {
  id: string;
  type: 'opportunity_added' | 'deadline_changed' | 'requirements_changed' | 'source_run' | 'source_warning' | 'match_update';
  title: string;
  body: string;
  opportunityId: string | null;
  sourceId: string | null;
  createdAt: string;
}
