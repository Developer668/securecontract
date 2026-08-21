import type { Opportunity } from "../../types.js";
import { parseContractSearch } from "../contract-search.js";

export type ChatTurn = { role: "user" | "assistant"; content: string; opportunityIds?: string[] };

export type RetrievalFilters = {
  status?: Opportunity["status"] | "all";
  countryCode?: string;
  sourceId?: string;
  dueAfter?: Date;
  dueBefore?: Date;
};

export type RetrievalOptions = RetrievalFilters & {
  limit?: number;
  requireTerms?: string[];
  priorIds?: string[];
  now?: Date;
  /** Selected-contract Q&A anchors on known records instead of enforcing keyword rules. */
  skipTermRequirements?: boolean;
};

export type RetrievalHit = { item: Opportunity; score: number };

export type RetrievalOutcome = {
  hits: RetrievalHit[];
  searched: number;
  relaxed: boolean;
  appliedFilters: string[];
};

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","been","best","but","by","can","could","contract","contracts",
  "due","find","first","for","from","has","have","how","in","into","is","it","its","me","my","next",
  "of","on","one","open","or","our","over","public","should","show","so","than","that","the","their",
  "them","then","there","these","they","this","those","to","up","us","was","we","were","what","when",
  "which","who","why","will","with","within","would","you","your","days","day","opportunity",
  "opportunities","tender","tenders","listing","listings","record","records",
]);

const STATUS_TERMS: Array<[RegExp, Opportunity["status"]]> = [
  [/\bclosed?\b/i, "closed"],
  [/\bawarded?\b/i, "awarded"],
  [/\bcancelled|canceled\b/i, "cancelled"],
];

const FIELD_WEIGHTS = {
  title: 3,
  buyer: 2,
  industry: 2.5,
  jurisdiction: 2,
  procedure: 2,
  description: 1,
} as const;

const tokenize = (text: string): string[] =>
  text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1 && !STOPWORDS.has(term));

const documentText = (item: Opportunity): Array<[string, number]> => [
  [`${item.titleOriginal} ${item.titleEnglish ?? ""}`, FIELD_WEIGHTS.title],
  [item.buyerOriginal, FIELD_WEIGHTS.buyer],
  [item.industryCodes.map((code) => `${code.code} ${code.label ?? ""}`).join(" "), FIELD_WEIGHTS.industry],
  [`${item.countryName} ${item.jurisdiction ?? ""}`, FIELD_WEIGHTS.jurisdiction],
  [item.procedureTypeOriginal ?? item.procedureType, FIELD_WEIGHTS.procedure],
  [`${item.descriptionEnglish ?? ""} ${item.descriptionOriginal ?? ""}`, FIELD_WEIGHTS.description],
];

const dueAt = (item: Opportunity): Date | undefined => {
  if (!item.submissionDueAt) return undefined;
  const parsed = new Date(item.submissionDueAt);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
};

type IndexedDoc = {
  item: Opportunity;
  weights: Map<string, number>;
  norm: number;
  text: string;
};

/**
 * In-process vector-space index (sparse tf-idf vectors, cosine similarity)
 * over the accepted canonical opportunity set. Built once and reused until
 * the underlying record count changes, so each chat request scores a compact
 * candidate list instead of regex-scanning every record.
 */
export class OpportunityIndex {
  private readonly docs: IndexedDoc[] = [];
  private readonly postings = new Map<string, Array<{ doc: number; weight: number }>>();
  private readonly idf = new Map<string, number>();
  private readonly docIds = new Map<string, number>();
  readonly size: number;

  constructor(opportunities: Opportunity[]) {
    this.size = opportunities.length;
    opportunities.forEach((item, doc) => {
      this.docIds.set(item.id, doc);
      const weights = new Map<string, number>();
      const textParts: string[] = [];
      for (const [text, fieldWeight] of documentText(item)) {
        textParts.push(text);
        for (const term of tokenize(text)) {
          weights.set(term, (weights.get(term) ?? 0) + fieldWeight);
        }
      }
      const norm = Math.sqrt([...weights.values()].reduce((sum, weight) => sum + weight * weight, 0));
      this.docs.push({ item, weights, norm, text: textParts.join(" ").toLowerCase() });
      for (const [term, weight] of weights) {
        const posting = this.postings.get(term);
        if (posting) posting.push({ doc, weight });
        else this.postings.set(term, [{ doc, weight }]);
      }
    });
    for (const [term, posting] of this.postings) {
      this.idf.set(term, Math.log(1 + opportunities.length / posting.length));
    }
  }

  private passesFilters(item: Opportunity, options: RetrievalOptions): boolean {
    if (options.status && options.status !== "all" && item.status !== options.status) return false;
    if (options.countryCode && item.countryCode !== options.countryCode) return false;
    if (options.sourceId && item.sourceId !== options.sourceId) return false;
    if (options.dueBefore || options.dueAfter) {
      const deadline = dueAt(item);
      if (!deadline) return false;
      if (options.dueAfter && deadline < options.dueAfter) return false;
      if (options.dueBefore && deadline > options.dueBefore) return false;
    }
    return true;
  }

  search(question: string, options: RetrievalOptions = {}): RetrievalOutcome {
    const now = options.now ?? new Date();
    const constraints = parseContractSearch(question, now);
    const status =
      options.status ??
      STATUS_TERMS.find(([pattern]) => pattern.test(question))?.[1] ??
      "open";
    const countryCode = options.countryCode ?? constraints.countryCode;
    const filters: RetrievalFilters = {
      status,
      countryCode,
      sourceId: options.sourceId,
      dueAfter: options.dueAfter ?? constraints.dueAfter,
      dueBefore: options.dueBefore ?? constraints.dueBefore,
    };
    const eligible = options.requireTerms ?? [];
    const priorIds = new Set(options.priorIds ?? []);

    const runSearch = (
      requireTerms: string[],
      applyCapabilities: boolean,
    ): { hits: RetrievalHit[]; lexicalMatch: boolean } => {
      const queryWeights = new Map<string, number>();
      for (const term of tokenize(question)) {
        queryWeights.set(term, (queryWeights.get(term) ?? 0) + 1);
      }
      let queryNorm = 0;
      for (const weight of queryWeights.values()) queryNorm += weight * weight;
      queryNorm = Math.sqrt(queryNorm);

      const candidates = new Set<number>();
      for (const term of queryWeights.keys()) {
        for (const { doc } of this.postings.get(term) ?? []) candidates.add(doc);
      }
      const lexicalMatch = candidates.size > 0;
      for (const priorId of priorIds) {
        const doc = this.docIds.get(priorId);
        if (doc !== undefined) candidates.add(doc);
      }
      if (!candidates.size) {
        for (let doc = 0; doc < this.docs.length; doc += 1) candidates.add(doc);
      }

      const scored: RetrievalHit[] = [];
      for (const doc of candidates) {
        const record = this.docs[doc]!;
        if (!this.passesFilters(record.item, filters)) continue;
        if (
          applyCapabilities &&
          constraints.capabilities.length &&
          !constraints.capabilities.every((capability) =>
            capability.patterns.some((pattern) => pattern.test(record.text)),
          )
        )
          continue;
        if (
          requireTerms.length &&
          !requireTerms.every((term) =>
            record.weights.has(term) ||
            [...record.weights.keys()].some((key) => key.startsWith(term)),
          )
        )
          continue;

        let dot = 0;
        for (const [term, queryWeight] of queryWeights) {
          const docWeight = record.weights.get(term);
          if (docWeight === undefined) continue;
          const idf = this.idf.get(term) ?? 0;
          dot += queryWeight * docWeight * idf;
        }
        let score = queryNorm > 0 && record.norm > 0 ? dot / (queryNorm * record.norm) : 0;

        const haystackTitle = `${record.item.titleOriginal} ${record.item.titleEnglish ?? ""}`.toLowerCase();
        for (const capability of constraints.capabilities) {
          if (capability.patterns.some((pattern) => pattern.test(haystackTitle))) score += 0.45;
          else if (capability.patterns.some((pattern) => pattern.test(record.item.buyerOriginal))) score += 0.12;
        }
        if ([...queryWeights.keys()].some((term) => haystackTitle.includes(term))) score += 0.18;
        if (record.item.status === "open") score += 0.08;
        if (priorIds.has(record.item.id)) score += 0.5;
        const deadline = dueAt(record.item);
        if (deadline && deadline >= now) {
          score += Math.max(0, 0.12 - Math.floor((deadline.getTime() - now.getTime()) / 86_400_000) / 1200);
        }
        if (score > 0) scored.push({ item: record.item, score });
      }
      scored.sort(
        (left, right) =>
          right.score - left.score ||
          (dueAt(left.item)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (dueAt(right.item)?.getTime() ?? Number.MAX_SAFE_INTEGER),
      );
      return { hits: scored.slice(0, options.limit ?? 10), lexicalMatch };
    };

    const requireTerms = options.skipTermRequirements
      ? []
      : eligible.length
        ? eligible
        : constraints.capabilities.length || !constraints.queryTerms.length
          ? []
          : constraints.queryTerms.filter((term) => (this.postings.get(term)?.length ?? 0) > 0);
    const primary = runSearch(requireTerms, true);
    let hits = primary.hits;
    let relaxed = false;
    if (!hits.length && (requireTerms.length || constraints.capabilities.length)) {
      hits = runSearch([], false).hits;
      relaxed = true;
    }
    if (!primary.lexicalMatch) {
      const topIsPrior = hits[0] !== undefined && priorIds.has(hits[0].item.id);
      relaxed = !topIsPrior;
    }
    const appliedFilters = [...constraints.appliedFilters];
    if (relaxed) appliedFilters.push("closest matches (no record met every keyword)");
    return { hits, searched: this.size, relaxed, appliedFilters };
  }
}

let cached: { count: number; builtAt: number; index: OpportunityIndex } | null = null;

export const getOpportunityIndex = (opportunities: Opportunity[]): OpportunityIndex => {
  if (cached && cached.count === opportunities.length && Date.now() - cached.builtAt < 60_000) {
    return cached.index;
  }
  cached = { count: opportunities.length, builtAt: Date.now(), index: new OpportunityIndex(opportunities) };
  return cached.index;
};

/** Merge the live question with recent turns so follow-ups stay context-aware. */
export const retrievalQuestion = (question: string, history: ChatTurn[]): string =>
  [
    question,
    ...history
      .filter((turn) => turn.role === "user")
      .slice(-2)
      .map((turn) => turn.content),
  ].join(" ");

export const priorIdsFromHistory = (history: ChatTurn[]): string[] => [
  ...new Set(history.flatMap((turn) => turn.opportunityIds ?? [])),
];
