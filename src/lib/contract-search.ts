import type { Opportunity } from "../types.js";

type SearchCapability = {
  label: string;
  patterns: RegExp[];
};

const capabilities: SearchCapability[] = [
  {
    label: "cybersecurity scope",
    patterns: [
      /\bcyber(?:\s|-)?security\b/i,
      /\bcyber(?:attack|defen[cs]e|threat)\b/i,
      /\binformation security\b/i,
      /\bthreat intelligence\b/i,
      /\bsecurity operations\b/i,
      /\bincident response\b/i,
      /\bnetwork security\b/i,
      /\bapplication security\b/i,
      /\bpenetration test(?:ing)?\b/i,
      /\bvulnerability (?:assessment|scan(?:ning)?|management)\b/i,
      /\bzero trust\b/i,
      /\bidentity (?:and|&) access\b/i,
      /\b(?:iam|siem|soc)\b/i,
    ],
  },
  {
    label: "cloud migration scope",
    patterns: [
      /\bcloud migration\b/i,
      /\bcloud transformation\b/i,
      /\bmigrat(?:e|ion) (?:to|of) (?:the )?cloud\b/i,
      /\bcloud (?:computing|moderni[sz]ation|platform)\b/i,
    ],
  },
  {
    label: "transport scope",
    patterns: [
      /\btransport(?:ation)?\b/i,
      /\btransit\b/i,
      /\b(?:rail|railway|highway|roadway|traffic|fleet|aviation|airport|port)\b/i,
    ],
  },
];

const ignoredTerms = new Set([
  "a", "an", "and", "are", "best", "canada", "canadian", "contract", "contracts",
  "due", "find", "for", "in", "next", "of", "open", "over", "public", "the",
  "this", "to", "within", "days", "day", "opportunity", "opportunities",
  "united", "states", "usa", "american", "australia", "australian",
]);

export type ContractSearchConstraints = {
  countryCode?: string;
  dueAfter?: Date;
  dueBefore?: Date;
  capabilities: SearchCapability[];
  queryTerms: string[];
  appliedFilters: string[];
};

export type ContractSearchResult = {
  items: Opportunity[];
  constraints: ContractSearchConstraints;
};

const countryFromQuestion = (question: string) => {
  if (/\b(canada|canadian)\b/i.test(question)) return "CA";
  if (/\b(australia|australian)\b/i.test(question)) return "AU";
  if (/\b(united states|u\.s\.|usa|american)\b/i.test(question)) return "US";
  return undefined;
};

const countryLabel = (countryCode?: string) =>
  countryCode === "CA" ? "Canada" : countryCode === "AU" ? "Australia" : countryCode === "US" ? "United States" : undefined;

const parseRelativeDeadline = (question: string, now: Date) => {
  const match = question.match(/\b(?:due\s+)?(?:within|in|over\s+the\s+next|next)\s+(\d{1,3})\s+days?\b/i);
  if (!match) return undefined;
  const days = Number(match[1]);
  if (!Number.isInteger(days) || days < 1 || days > 730) return undefined;
  const dueBefore = new Date(now);
  dueBefore.setUTCDate(dueBefore.getUTCDate() + days);
  return dueBefore;
};

const searchText = (item: Opportunity) => [
  item.titleOriginal,
  item.titleEnglish ?? "",
  item.descriptionOriginal ?? "",
  item.descriptionEnglish ?? "",
  item.buyerOriginal,
  item.jurisdiction ?? "",
  ...item.industryCodes.map((code) => `${code.code} ${code.label ?? ""}`),
  ...item.evidence.map((evidence) => `${evidence.fieldName} ${String(evidence.normalizedValue ?? "")}`),
].join(" ").toLowerCase();

const titleText = (item: Opportunity) => `${item.titleOriginal} ${item.titleEnglish ?? ""}`.toLowerCase();

const dueAt = (item: Opportunity) => {
  if (!item.submissionDueAt) return undefined;
  const parsed = new Date(item.submissionDueAt);
  return Number.isFinite(parsed.getTime()) ? parsed : undefined;
};

export const parseContractSearch = (question: string, now = new Date()): ContractSearchConstraints => {
  const countryCode = countryFromQuestion(question);
  const dueBefore = parseRelativeDeadline(question, now);
  const matchedCapabilities = capabilities.filter((capability) =>
    capability.patterns.some((pattern) => pattern.test(question)),
  );
  const queryTerms = [...new Set(
    question.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 2 && !ignoredTerms.has(term)),
  )];
  const appliedFilters = ["open contracts"];
  const country = countryLabel(countryCode);
  if (country) appliedFilters.push(country);
  if (dueBefore) appliedFilters.push(`deadline through ${dueBefore.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`);
  appliedFilters.push(...matchedCapabilities.map((capability) => capability.label));
  return {
    countryCode,
    dueAfter: dueBefore ? now : undefined,
    dueBefore,
    capabilities: matchedCapabilities,
    queryTerms,
    appliedFilters,
  };
};

export const searchContracts = (question: string, opportunities: Opportunity[], now = new Date()): ContractSearchResult => {
  const constraints = parseContractSearch(question, now);
  const candidates = opportunities
    .filter((item) => item.status === "open")
    .filter((item) => !constraints.countryCode || item.countryCode === constraints.countryCode)
    .filter((item) => {
      if (!constraints.dueBefore) return true;
      const deadline = dueAt(item);
      return Boolean(deadline && deadline >= constraints.dueAfter! && deadline <= constraints.dueBefore);
    })
    .map((item) => ({ item, text: searchText(item), title: titleText(item) }))
    .filter(({ text }) => constraints.capabilities.every((capability) => capability.patterns.some((pattern) => pattern.test(text))))
    .filter(({ text }) => {
      if (constraints.capabilities.length || !constraints.queryTerms.length) return true;
      return constraints.queryTerms.some((term) => text.includes(term));
    })
    .map(({ item, text, title }) => {
      let score = 0;
      for (const capability of constraints.capabilities) {
        if (capability.patterns.some((pattern) => pattern.test(title))) score += 120;
        else if (capability.patterns.some((pattern) => pattern.test(text))) score += 45;
      }
      for (const term of constraints.queryTerms) {
        if (title.includes(term)) score += 16;
        else if (text.includes(term)) score += 5;
      }
      const deadline = dueAt(item);
      if (deadline && constraints.dueBefore) score += Math.max(0, 12 - Math.floor((deadline.getTime() - now.getTime()) / 86_400_000) / 10);
      return { item, score };
    })
    .sort((left, right) => right.score - left.score || (dueAt(left.item)?.getTime() ?? Number.MAX_SAFE_INTEGER) - (dueAt(right.item)?.getTime() ?? Number.MAX_SAFE_INTEGER))
    .slice(0, 10)
    .map(({ item }) => item);
  return { items: candidates, constraints };
};
