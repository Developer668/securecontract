import { describe, expect, it } from "vitest";
import { searchContracts } from "../../src/lib/contract-search";
import type { Opportunity } from "../../src/types";

const opportunity = (overrides: Partial<Opportunity>): Opportunity => ({
  id: crypto.randomUUID(),
  sourceId: "source",
  externalId: null,
  opportunityKind: "contract",
  countryCode: "CA",
  countryName: "Canada",
  jurisdiction: null,
  buyerOriginal: "Public buyer",
  buyerNormalized: null,
  titleOriginal: "Untitled opportunity",
  titleEnglish: null,
  descriptionOriginal: null,
  descriptionEnglish: null,
  sourceLanguage: "en",
  status: "open",
  procedureTypeOriginal: null,
  procedureType: "other",
  industryCodes: [],
  currency: null,
  estimatedValueMinor: null,
  publishedAt: null,
  questionsDueAt: null,
  submissionDueAt: "2026-09-01T12:00:00.000Z",
  bidOpeningAt: null,
  prebidMeetingAt: null,
  localTimezone: "UTC",
  domesticOnly: null,
  registrationRequired: null,
  eligibilitySummary: null,
  sourceUrl: "https://example.test/opportunity",
  detailUrl: null,
  documents: [],
  amendments: [],
  collectedAt: "2026-08-18T00:00:00.000Z",
  firstSeenAt: "2026-08-18T00:00:00.000Z",
  lastSeenAt: "2026-08-18T00:00:00.000Z",
  contentHash: "hash",
  verification: "verified",
  sourceHealth: "healthy",
  evidence: [],
  changes: [],
  raw: {},
  ...overrides,
});

describe("contract search", () => {
  it("applies country, deadline, and cybersecurity filters before relevance ranking", () => {
    const expected = opportunity({ titleOriginal: "Cyber Threat Intelligence Platform" });
    const results = searchContracts(
      "Find open cybersecurity contracts in Canada due within 60 days",
      [
        expected,
        opportunity({ titleOriginal: "Security guard services" }),
        opportunity({ titleOriginal: "Source Water Vulnerability Testing" }),
        opportunity({ titleOriginal: "Cyber incident response", submissionDueAt: "2031-10-01T12:00:00.000Z" }),
        opportunity({ titleOriginal: "Cybersecurity assessment", countryCode: "US", countryName: "United States" }),
      ],
      new Date("2026-08-18T00:00:00.000Z"),
    );

    expect(results.items.map((item) => item.id)).toEqual([expected.id]);
    expect(results.constraints.appliedFilters).toEqual([
      "open contracts",
      "Canada",
      "deadline through Oct 17, 2026",
      "cybersecurity scope",
    ]);
  });
});
