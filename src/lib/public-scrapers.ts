import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { load } from "cheerio";
import { parse } from "csv-parse/sync";
import type { SourceConfig } from "../types.js";
import { normalizeStatus, parseLocalDate, statusAtDeadline } from "./normalization.js";

const execFileAsync = promisify(execFile);

async function fetchHtml(url: string) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    },
  });
  if (response.ok) return response.text();

  // CanadaBuys currently rejects Node's TLS fingerprint while serving the same
  // public, anonymous HTML to browsers and curl. The fixed argument list keeps
  // this fallback scoped to the configured public source URL.
  const { stdout } = await execFileAsync(
    "curl",
    ["--compressed", "--fail", "--location", "--silent", "--show-error", url],
    { maxBuffer: 24 * 1024 * 1024, timeout: 30_000 },
  );
  return stdout;
}

type TedLocalized = Record<string, string | string[]>;
type TedNotice = {
  "publication-number"?: string;
  "notice-title"?: TedLocalized;
  "buyer-name"?: TedLocalized;
  "form-type"?: string;
  "deadline-receipt-tender-date-lot"?: string[];
  "publication-date"?: string;
  links?: { html?: Record<string, string> };
};

const localizedEnglish = (value: TedLocalized | undefined) =>
  (() => {
    const localized = value?.eng ?? value?.[Object.keys(value)[0] ?? ""] ?? "";
    return Array.isArray(localized) ? localized[0] ?? "" : localized;
  })();
const tedDeadlineIso = (value: string) => {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(Z|[+-]\d{2}:\d{2})$/);
  return match ? `${match[1]}T23:59:59${match[2]}` : value;
};

export function tedRows(notices: TedNotice[], source: SourceConfig) {
  return notices
    .map((notice) => {
      const deadlines = notice["deadline-receipt-tender-date-lot"] ?? [];
      // A notice may contain several lots. Keep it discoverable while at least
      // one lot is still open, represented by the latest tender deadline.
      const closingDate = tedDeadlineIso(deadlines.sort().at(-1) ?? "");
      const publicationNumber = notice["publication-number"] ?? "";
      return {
        title: localizedEnglish(notice["notice-title"]),
        solicitation_id: publicationNumber,
        organization: localizedEnglish(notice["buyer-name"]) || "European public buyer",
        status_raw: "Open",
        procedure_type_raw: notice["form-type"] || "Competition",
        published_date_raw: notice["publication-date"]
          ? tedDeadlineIso(notice["publication-date"])
          : undefined,
        closing_date_raw: closingDate,
        detail_url:
          notice.links?.html?.ENG ||
          (publicationNumber
            ? `https://ted.europa.eu/en/notice/-/detail/${encodeURIComponent(publicationNumber)}`
            : source.sourceUrl),
        source_url: source.sourceUrl,
      };
    })
    .filter(
      (row) =>
        row.title &&
        row.solicitation_id &&
        row.closing_date_raw &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

async function scrapeTedSource(source: SourceConfig, targetRows = 4_500) {
  const fields = [
    "publication-number",
    "notice-title",
    "buyer-name",
    "form-type",
    "deadline-receipt-tender-date-lot",
    "publication-date",
  ];
  const rows: ReturnType<typeof tedRows> = [];
  const seen = new Set<string>();
  const limit = 250;
  const maxPages = Math.ceil(targetRows / limit) + 4;

  for (let page = 1; page <= maxPages && rows.length < targetRows; page += 1) {
    const response = await fetch(source.inputUrl, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        query: `deadline-receipt-tender-date-lot >= ${new Date().toISOString().slice(0, 10).replaceAll("-", "")}`,
        fields,
        page,
        limit,
        paginationMode: "PAGE_NUMBER",
      }),
    });
    if (!response.ok) throw new Error(`TED search failed with HTTP ${response.status}`);
    const payload = (await response.json()) as { notices?: TedNotice[] };
    const pageRows = tedRows(payload.notices ?? [], source);
    if (!pageRows.length) break;
    for (const row of pageRows) {
      if (seen.has(row.solicitation_id)) continue;
      seen.add(row.solicitation_id);
      rows.push(row);
      if (rows.length >= targetRows) break;
    }
  }
  return rows;
}

const absoluteUrl = (value: string | undefined, base: string) =>
  value ? new URL(value, base).toString() : base;
const isOpenAtCollection = (
  statusRaw: string | undefined,
  closingRaw: string | undefined,
  source: SourceConfig,
) =>
  statusAtDeadline(
    normalizeStatus(statusRaw),
    closingRaw ? parseLocalDate(closingRaw, source.timezone) : null,
  ) === "open";

function canadaBuysRows(html: string, source: SourceConfig) {
  type CanadaRow = Record<string, string>;
  const rows = parse(html, {
    bom: true,
    columns: true,
    relax_column_count: true,
    skip_empty_lines: true,
  }) as CanadaRow[];
  return rows
    .sort((left, right) =>
      (right["publicationDate-datePublication"] ?? "").localeCompare(
        left["publicationDate-datePublication"] ?? "",
      ),
    )
    .map((row) => ({
      title: row["title-titre-eng"],
      solicitation_id:
        row["solicitationNumber-numeroSollicitation"] ||
        row["referenceNumber-numeroReference"],
      organization: row["contractingEntityName-nomEntitContractante-eng"],
      status_raw: row["tenderStatus-appelOffresStatut-eng"] || "Open",
      procedure_type_raw:
        row["noticeType-avisType-eng"] ||
        row["procurementMethod-methodeApprovisionnement-eng"] ||
        row["procurementCategory-categorieApprovisionnement"],
      published_date_raw: row["publicationDate-datePublication"],
      closing_date_raw: row["tenderClosingDate-appelOffresDateCloture"],
      brief_description: row["tenderDescription-descriptionAppelOffres-eng"]
        ?.replace(/\s+/g, " ")
        .trim()
        .slice(0, 1200),
      detail_url:
        row["noticeURL-URLavis-eng"] ||
        (row["referenceNumber-numeroReference"]
          ? `https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/${encodeURIComponent(row["referenceNumber-numeroReference"])}`
          : source.sourceUrl),
      source_url: source.sourceUrl,
    }))
    .filter(
      (row) =>
        row.title &&
        row.detail_url &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

function chicagoRows(html: string, source: SourceConfig) {
  const $ = load(html);
  return $("table tbody tr")
    .slice(0, 25)
    .map((_, row) => {
      const cells = $(row)
        .find("td")
        .map((__, cell) => $(cell).text().replace(/\s+/g, " ").trim())
        .get();
      const link = $(row).find("a").last();
      return {
        title: cells[3],
        solicitation_id: cells[2],
        organization: cells[0] === "CITY" ? "City of Chicago" : cells[0],
        status_raw: cells[4] || "Open",
        procedure_type_raw: cells[1],
        closing_date_raw: cells[6],
        detail_url: absoluteUrl(link.attr("href"), source.sourceUrl),
        source_url: source.sourceUrl,
      };
    })
    .get()
    .filter(
      (row) =>
        row.title &&
        row.detail_url &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

type JsonRow = Record<string, unknown>;
const jsonRows = (text: string) => JSON.parse(text) as JsonRow[];
const stringValue = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";
const publicDate = (value: unknown) => {
  const date = stringValue(value);
  return /^(?:9999|0000)-/.test(date) ? "" : date;
};
const nestedUrl = (value: unknown) => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "url" in value)
    return stringValue((value as { url?: unknown }).url);
  return "";
};

function nycRows(text: string, source: SourceConfig) {
  return jsonRows(text)
    .map((row) => {
      const requestId = stringValue(row.request_id);
      const description = [
        row.additional_description_1,
        row.additional_description_2,
        row.additional_description_3,
      ]
        .map(stringValue)
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .slice(0, 1200);
      return {
        title: stringValue(row.short_title),
        solicitation_id: requestId || stringValue(row.pin),
        organization: stringValue(row.agency_name) || "City of New York",
        status_raw: "Open",
        procedure_type_raw: stringValue(row.selection_method_description),
        published_date_raw: publicDate(row.start_date),
        closing_date_raw: publicDate(row.due_date),
        brief_description: description || undefined,
        detail_url: requestId
          ? `https://a856-cityrecord.nyc.gov/RequestDetail/${encodeURIComponent(requestId)}`
          : source.sourceUrl,
        source_url: source.sourceUrl,
      };
    })
    .filter(
      (row) =>
        row.title &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

function montgomeryRows(text: string, source: SourceConfig) {
  return jsonRows(text)
    .map((row) => ({
      title: stringValue(row.description),
      solicitation_id: stringValue(row.number),
      organization: stringValue(row.department) || "Montgomery County",
      status_raw: stringValue(row.status),
      procedure_type_raw: stringValue(row.type),
      published_date_raw: publicDate(row.issuancedate),
      closing_date_raw: publicDate(row.closingdate),
      brief_description: [
        stringValue(row.construction) === "Y" ? "Construction solicitation" : "",
        stringValue(row.lsbrpindicator) === "Y" ? "Local Small Business Reserve Program" : "",
      ].filter(Boolean).join(" · ") || undefined,
      detail_url: source.sourceUrl,
      source_url: source.sourceUrl,
    }))
    .filter(
      (row) =>
        row.title &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

function sanFranciscoRows(text: string, source: SourceConfig) {
  return jsonRows(text)
    .map((row) => ({
      title: stringValue(row.title),
      solicitation_id: stringValue(row.event_id),
      organization: stringValue(row.department) || "City and County of San Francisco",
      status_raw: /open|amended/i.test(stringValue(row.status)) ? "Open" : stringValue(row.status),
      procedure_type_raw: stringValue(row.type),
      published_date_raw: publicDate(row.open_date),
      closing_date_raw: publicDate(row.due_date),
      brief_description: stringValue(row.category) || undefined,
      detail_url: nestedUrl(row.sfcitypartner_link) || source.sourceUrl,
      source_url: source.sourceUrl,
    }))
    .filter(
      (row) =>
        row.title &&
        isOpenAtCollection(row.status_raw, row.closing_date_raw, source),
    );
}

function sourceRequestUrl(source: SourceConfig) {
  const url = new URL(source.inputUrl);
  if (source.slug === "us-nyc-current-bids") {
    url.searchParams.set("$limit", "5000");
    url.searchParams.set("$order", "due_date ASC");
    url.searchParams.set(
      "$where",
      `due_date > '${new Date().toISOString().slice(0, 19)}' AND type_of_notice_description = 'Solicitation'`,
    );
  }
  if (source.slug === "us-montgomery-solicitations") {
    url.searchParams.set("$limit", "2000");
    url.searchParams.set("$where", "status = 'Active'");
  }
  if (source.slug === "us-san-francisco-bids") {
    url.searchParams.set("$limit", "2000");
  }
  return url.toString();
}

export async function scrapePublicSource(source: SourceConfig) {
  if (source.slug === "eu-ted-open-notices") return scrapeTedSource(source);
  const html = await fetchHtml(sourceRequestUrl(source));
  if (source.slug === "canada-canadabuys") return canadaBuysRows(html, source);
  if (source.slug === "us-chicago-solicitations") return chicagoRows(html, source);
  if (source.slug === "us-nyc-current-bids") return nycRows(html, source);
  if (source.slug === "us-montgomery-solicitations") return montgomeryRows(html, source);
  if (source.slug === "us-san-francisco-bids") return sanFranciscoRows(html, source);
  throw new Error(`No public scraper is registered for ${source.slug}`);
}

export const publicScraperParsers = {
  canadaBuysRows,
  chicagoRows,
  nycRows,
  montgomeryRows,
  sanFranciscoRows,
  tedRows,
};
