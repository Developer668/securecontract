import { describe, expect, it } from "vitest";
import {
  OpportunityIndex,
  getOpportunityIndex,
  priorIdsFromHistory,
  retrievalQuestion,
} from "../../src/lib/ai/retrieval";
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

const now = new Date("2026-08-21T00:00:00.000Z");

describe("opportunity retrieval index", () => {
  it("ranks title matches above description-only mentions", () => {
    const expected = opportunity({
      titleOriginal: "Cyber threat intelligence platform rollout",
    });
    const index = new OpportunityIndex([
      opportunity({ titleOriginal: "Road resurfacing", descriptionEnglish: "includes cyber threat intelligence awareness training" }),
      expected,
      opportunity({ titleOriginal: "Office furniture supply" }),
    ]);

    const outcome = index.search("cyber threat intelligence", { status: "all", now });

    expect(outcome.searched).toBe(3);
    expect(outcome.hits[0]?.item.id).toBe(expected.id);
    expect(outcome.hits).toHaveLength(2);
  });

  it("defaults to open records and honours explicit closed-status questions", () => {
    const open = opportunity({ titleOriginal: "Bridge repair services" });
    const closed = opportunity({ titleOriginal: "Bridge repair services", status: "closed" });
    const index = new OpportunityIndex([open, closed]);

    expect(index.search("bridge repair", { now }).hits.map((hit) => hit.item.id)).toEqual([open.id]);
    expect(
      index.search("show me the closed bridge repair contracts", { now }).hits.map((hit) => hit.item.id),
    ).toEqual([closed.id]);
  });

  it("applies country and deadline windows from the question", () => {
    const canadaDueSoon = opportunity({ titleOriginal: "Cloud migration discovery", countryCode: "CA" });
    const usRecord = opportunity({ titleOriginal: "Cloud migration delivery", countryCode: "US", countryName: "United States" });
    const tooLate = opportunity({
      titleOriginal: "Cloud migration strategy",
      submissionDueAt: "2027-01-01T12:00:00.000Z",
    });
    const index = new OpportunityIndex([canadaDueSoon, usRecord, tooLate]);

    const outcome = index.search("cloud migration in Canada due within 30 days", { now });

    expect(outcome.appliedFilters).toContain("Canada");
    expect(outcome.hits.map((hit) => hit.item.id)).toEqual([canadaDueSoon.id]);
    expect(outcome.hits).not.toContain(usRecord);
    expect(outcome.hits).not.toContain(tooLate);
  });

  it("boosts prior conversation candidates so follow-ups stay context-aware", () => {
    const first = opportunity({ titleOriginal: "Fleet telematics pilot", buyerOriginal: "Metro Transit" });
    const other = opportunity({ titleOriginal: "Telematics data platform", buyerOriginal: "Rail Agency" });
    const index = new OpportunityIndex([first, other]);
    const history = [
      { role: "assistant" as const, content: "Compare these fleet options.", opportunityIds: [first.id] },
      { role: "user" as const, content: "Which closes first?" },
    ];

    const followUp = index.search(retrievalQuestion("Which closes first?", history), {
      priorIds: priorIdsFromHistory(history),
      now,
    });

    expect(followUp.hits[0]?.item.id).toBe(first.id);
  });

  it("falls back to closest matches when the question shares no vocabulary with records", () => {
    const partial = opportunity({ titleOriginal: "Security operations support" });
    const index = new OpportunityIndex([partial, opportunity({ titleOriginal: "Landscaping" })]);

    const outcome = index.search("quantum underwater basket weaving consultancy", { now });

    expect(outcome.relaxed).toBe(true);
    expect(outcome.appliedFilters.some((filter) => filter.includes("closest matches"))).toBe(true);
    expect(outcome.hits.length).toBeGreaterThan(0);
  });

  it("caches the singleton until the record count changes", () => {
    const records = [opportunity({}), opportunity({})];
    const initial = getOpportunityIndex(records);
    expect(getOpportunityIndex([...records])).toBe(initial);
    expect(getOpportunityIndex([...records, opportunity({})])).not.toBe(initial);
  });
});
