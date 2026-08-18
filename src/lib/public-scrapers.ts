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
    { maxBuffer: 12 * 1024 * 1024, timeout: 30_000 },
  );
  return stdout;
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
    )
    .slice(0, 25);
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
    )
    .slice(0, 25);
}

export async function scrapePublicSource(source: SourceConfig) {
  const html = await fetchHtml(source.inputUrl);
  if (source.slug === "canada-canadabuys") return canadaBuysRows(html, source);
  if (source.slug === "us-chicago-solicitations") return chicagoRows(html, source);
  throw new Error(`No public scraper is registered for ${source.slug}`);
}

export const publicScraperParsers = { canadaBuysRows, chicagoRows };
