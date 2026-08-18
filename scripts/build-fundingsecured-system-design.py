from __future__ import annotations

import hashlib
import io
import shutil
import textwrap
import zipfile
from pathlib import Path

from lxml import etree
from PIL import Image, ImageDraw, ImageFont


REFERENCE = Path("/Users/adityadas/.codex/plugins/cache/openai-curated-remote/openai-templates/0.1.1/skills/artifact-template-system-design/assets/reference.docx")
OUTPUT = Path("docs/fundingsecured-system-design/FundingSecured-System-Design.docx")
EXPECTED_SHA256 = "13504f6c221a42c1726460a9e865e563355539ff97d702d6c9b2267b4b261d76"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"


def set_text(element: etree._Element, value: str) -> None:
    nodes = element.xpath(".//w:t", namespaces=NS)
    if not nodes:
        raise RuntimeError("Expected an existing text run")
    nodes[0].text = value
    nodes[0].set("{http://www.w3.org/XML/1998/namespace}space", "preserve")
    for node in nodes[1:]:
        node.text = ""


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "HelveticaNeue-bold.ttf" if bold else "HelveticaNeue-regular.ttf"
    path = f"/System/Library/Fonts/{name}"
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)


def architecture_image() -> bytes:
    width, height = 1800, 800
    image = Image.new("RGB", (width, height), "#F3F8FC")
    draw = ImageDraw.Draw(image)
    navy, blue, muted, white = "#0B2F52", "#2F75A8", "#5B7085", "#FFFFFF"
    draw.rectangle((0, 0, width, 128), fill=navy)
    draw.text((64, 35), "FundingSecured — evidence-grounded funding intelligence", font=font(38, True), fill=white)
    draw.text((64, 86), "US biomedical research · Bright Data-only collection · NVIDIA NIM reasoning", font=font(21), fill="#D7E6F2")

    boxes = [
        (55, 225, 305, 390, "US funding\nsources", "20–40 curated pages"),
        (365, 225, 645, 390, "Bright Data\nCollectors", "raw snapshot + Collector ID"),
        (705, 225, 985, 390, "Quality gate +\nnormalizer", "reject drift; keep last good"),
        (1045, 225, 1325, 390, "Evidence +\nversion store", "passages, diffs, deadlines"),
        (1385, 225, 1745, 390, "Discovery, match,\nchat, and alerts", "NIM answers from evidence"),
    ]
    for x1, y1, x2, y2, title, subtitle in boxes:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill=white, outline=navy, width=3)
        draw.multiline_text((x1 + 24, y1 + 24), title, font=font(27, True), fill=navy, spacing=6)
        draw.text((x1 + 24, y2 - 40), subtitle, font=font(17), fill=muted)
    for left, right in zip(boxes, boxes[1:]):
        y = 307
        x1, x2 = left[2] + 8, right[0] - 12
        draw.line((x1, y, x2, y), fill=blue, width=5)
        draw.polygon([(x2, y), (x2 - 18, y - 11), (x2 - 18, y + 11)], fill=blue)

    lower = [
        (365, 525, 750, 680, "Collector registry + healing", "Schema version, field checks, approval, rerun same Collector ID"),
        (795, 525, 1180, 680, "PostgreSQL audit boundary", "Profiles, opportunities, evidence, changes, workspaces, alerts"),
        (1225, 525, 1610, 680, "Operations + observability", "Freshness, missing fields, expired records, run health, review queue"),
    ]
    for x1, y1, x2, y2, title, subtitle in lower:
        draw.rounded_rectangle((x1, y1, x2, y2), radius=18, fill="#DDEAF4", outline="#8BB5D4", width=2)
        draw.text((x1 + 22, y1 + 25), title, font=font(24, True), fill=navy)
        wrapped = textwrap.fill(subtitle, width=39)
        draw.multiline_text((x1 + 22, y1 + 72), wrapped, font=font(17), fill=muted, spacing=5)
    for x in (505, 910, 1175, 1530):
        draw.line((x, 398, x, 500), fill=blue, width=4)
        draw.polygon([(x, 510), (x - 10, 491), (x + 10, 491)], fill=blue)
    draw.text((64, 742), "Safety invariant: no eligibility conclusion or application task is published without traceable source evidence.", font=font(21, True), fill=navy)
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def main() -> None:
    digest = hashlib.sha256(REFERENCE.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError("Retained template changed; distill it again before authoring")
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(REFERENCE, OUTPUT)

    paragraph_replacements = {
        8: "FundingSecured",
        9: "Biomedical Funding System",
        22: "FundingSecured helps early-stage US biomedical labs and research startups find non-dilutive funding without a grant administrator. Bright Data Collectors monitor 20–40 curated sources; an evidence-first pipeline versions exact passages, detects changes, and powers responsive discovery plus NVIDIA NIM chat. Eligibility remains a constrained assessment, never a definitive determination.",
        23: "The first release covers US biomedical and translational teams, public English-language pages, daily refresh, and reviewed scraper healing. It excludes global coverage, automated submission, private portals, and unsupported eligibility claims. Stale deadlines close automatically, and failed extraction cannot replace the last accepted record.",
        28: "Scientists search fragmented federal, foundation, society, university, corporate, accelerator, equipment-access, and compute-credit pages whose requirements and dates change without consistent feeds. Generic search misses this long tail, while ungrounded AI can turn absent language into false eligibility. Small teams lose research time and still risk expired or mismatched applications.",
        29: "FundingSecured owns Bright Data collection, raw retention, validation, evidence, versioning, matching, workflows, alerts, and grounded chat. Official funders remain authoritative; researchers approve profile facts, healing proposals, interpretation, and submission. No consequential conclusion may appear without a linkable source passage.",
        33: "Figure 1. FundingSecured proposed architecture.",
        40: "A researcher saves a lab profile or asks a natural-language question; a scheduled or manual source run may also enter through the operations API. Required inputs are source configuration, Collector ID, schema version, lab profile, and user intent.",
        41: "The API validates identity, payload limits, US scope, public HTTPS source URLs, collector identifiers, and enum values. Profile facts and collected records are normalized before matching; Bright Data and NVIDIA keys never reach the browser.",
        42: "The orchestrator loads the pinned source schema, last accepted snapshot, lab profile version, match policy, deadline policy, and evidence threshold. A request cannot silently switch policy or evidence versions mid-run.",
        43: "Collection archives raw rows first, validates completeness and dates, then publishes normalized opportunities and passage evidence. Matching computes deterministic hard constraints before NIM explains soft fit, missing information, capabilities, partners, and tasks.",
        44: "The raw snapshot, run identifier, Collector ID, schema version, observed timestamp, and validation result are durable before publication. Match and chat responses store their opportunity and profile versions for audit and replay.",
        45: "Bright Data trigger and dataset polling use bounded retries and timeouts. NVIDIA calls are optional and fail closed to an evidence-only interface. Repeated jobs are idempotent by source, collection, schema, and content hash.",
        46: "The system commits accepted versions and field-level diffs, closes expired records, recomputes impacted matches and tasks, emits live-feed events, and schedules alerts. Failed runs preserve last-known-good opportunities and surface a review item.",
        54: "Raw collection and validation must commit before normalized publication; a failed quality gate cannot replace accepted opportunity state.",
        55: "Runs are keyed by source ID and Bright Data collection ID; opportunity versions use stable source identity plus content hash, making retries idempotent.",
        56: "Collector ID, collection ID, source/schema version, profile version, evidence passage IDs, prompt policy version, timestamps, and model name are retained for replay.",
        57: "Official linked passages are authoritative for displayed requirements. Match scores, eligibility states, explanations, and generated tasks are decision support, not funder determinations.",
        58: "The implementation contracts live in the versioned TypeScript types, Zod request schemas, and Drizzle migrations in this repository.",
        59: "Every incompatible contract change requires a schema version, migration, recorded fixture, and replay test.",
        63: "Ingestion is at-least-once but publication is idempotent. A source run sees one pinned collector/schema version; a match sees one opportunity/profile pair. Raw snapshots are immutable, accepted opportunity versions are append-only, and current views are derived. Duplicate NIM requests may occur after a timeout, but no external application side effect exists. Replays produce the same canonical output for the same snapshot and policy version.",
        67: "Tenant-scoped lab profiles and workspaces require authenticated access and ownership checks. Public funding evidence may be shared; private profile facts, notes, and conversations remain isolated.",
        68: "Collect public funding pages only. Minimize profile data to research fit fields, redact secrets and personal contact details from logs, and send NVIDIA only the selected context needed for the question.",
        69: "Bright Data, NVIDIA NIM, database, and cron credentials are server-side environment secrets. Never expose them in browser bundles, API responses, prompts, fixtures, or telemetry.",
        70: "Source onboarding defaults to draft; healing defaults to proposal-only; publication defaults to last-known-good; replay defaults to no alerts. Approval is required before changing a live Collector schema.",
        71: "Retain raw snapshots and evidence under a documented policy, support profile/workspace deletion, record administrative approvals, and keep source URLs and observation dates for audit. US-only launch avoids cross-border data-residency assumptions.",
        81: "Which 20–40 biomedical sources form the launch portfolio, and what minimum evidence quality qualifies each for production?",
        82: "What notification channels and user-configurable quiet hours should ship after in-app alerts?",
        83: "What daily Bright Data collection budget and source-specific cadence balance deadline freshness against cost?",
        84: "Who may approve Collector healing proposals in a multi-tenant deployment, and what separation of duties is required?",
        87: "Approve an evidence-gated US biomedical launch. Build the vertical slice around curated source registry, Bright Data-only ingestion, lab profile, discovery feed, match detail, and grounded NIM chat. Prove a controlled schema break and approved same-Collector repair before pilot use. Expand only after daily freshness, citation coverage, and false-eligibility review gates remain healthy.",
    }

    table_values = {
        (0, 0, 0): "STATUS\nProposed",
        (0, 0, 2): "OWNER\nFundingSecured",
        (0, 0, 4): "LAST UPDATED\nAugust 18, 2026",
        (1, 0, 1): "FundingSecured product and engineering",
        (1, 1, 1): "Research operations, security, and domain reviewers",
        (1, 2, 1): "docs/architecture.md; docs/bright-data-proof.md; docs/nvidia-nim.md",
        (1, 3, 1): "US biomedical funding discovery, evidence-grounded matching, and application guidance.",
        (2, 1, 0): "Return eligibility state, explainable match, amount, deadline, partners, capabilities, gaps, exact passages, tasks, and change alerts.",
        (2, 1, 1): "No definitive legal eligibility, win prediction, or autonomous application submission.",
        (2, 2, 0): "Monitor 20–40 high-value US biomedical sources daily through Bright Data Collectors only.",
        (2, 2, 1): "No worldwide or all-discipline coverage in the initial product.",
        (2, 3, 0): "Preserve raw snapshots, versions, source passages, and last-known-good state through scraper drift.",
        (2, 3, 1): "No restricted portals, authentication bypass, CAPTCHA evasion, or personal-data harvesting.",
        (2, 4, 0): "Expose live discovery, grounded chat, application tasks, alerts, and reviewed same-Collector healing from the UI.",
        (2, 4, 1): "No guarantee that a funder accepts an application or that published pages are error-free.",
        (3, 1, 0): "Bright Data collection plane",
        (3, 1, 1): "Trigger/poll approved Collectors, archive raw snapshots, and retain stable Collector IDs.",
        (3, 1, 2): "Bright Data datasets + run metadata",
        (3, 1, 3): "Timeout or invalid output produces a degraded run; accepted records remain unchanged.",
        (3, 2, 0): "Ingestion and evidence engine",
        (3, 2, 1): "Validate schema/freshness, normalize funding fields, extract exact passages, version material changes.",
        (3, 2, 2): "PostgreSQL raw, canonical, evidence, change tables",
        (3, 2, 3): "Fail closed on publication; create a healing proposal when required fields disappear.",
        (3, 3, 0): "Match and workflow engine",
        (3, 3, 1): "Apply hard constraints, compute fit, identify gaps/partners, and generate application tasks/timeline.",
        (3, 3, 2): "Versioned profiles, match records, workspaces",
        (3, 3, 3): "Insufficient evidence lowers eligibility state and blocks confident claims.",
        (3, 4, 0): "NVIDIA NIM copilot",
        (3, 4, 1): "Answer across listings or one opportunity using bounded context and evidence passage IDs.",
        (3, 4, 2): "NVIDIA endpoint; conversation audit records",
        (3, 4, 3): "Unavailable model yields deterministic filters and source evidence, never fabricated prose.",
        (3, 5, 0): "Web app, live feed, and operations",
        (3, 5, 1): "Responsive discovery/chat, profiles, detail, tasks, alerts, source health, and healing review.",
        (3, 5, 2): "API read models + event cursor",
        (3, 5, 3): "Reconnect from cursor; show data age and service state instead of implying freshness.",
        (4, 1, 0): "eligibilityState", (4, 1, 1): "enum", (4, 1, 2): "Yes", (4, 1, 3): "verified_eligible | likely_confirmation_required | insufficient_evidence | not_eligible; deterministic evidence gate.",
        (4, 2, 0): "matchScore", (4, 2, 1): "integer 0–100", (4, 2, 2): "Yes", (4, 2, 3): "Weighted research, stage, geography, amount, capability, and collaboration fit; explanation stores rule contributions.",
        (4, 3, 0): "funding", (4, 3, 1): "object", (4, 3, 2): "No", (4, 3, 3): "Minimum/maximum/currency and deadline with raw text, normalized value, timezone, and passage evidence.",
        (4, 4, 0): "requirements", (4, 4, 1): "array", (4, 4, 2): "Yes", (4, 4, 3): "Institution, career stage, partner, equipment, geography, commercialization, and registration conditions.",
        (4, 5, 0): "evidencePassages", (4, 5, 1): "array", (4, 5, 2): "Yes", (4, 5, 3): "Exact source excerpt, URL, selector/locator, observed time, field, confidence, and opportunity version.",
        (4, 6, 0): "missingInformation", (4, 6, 1): "array", (4, 6, 2): "Yes", (4, 6, 3): "Profile or source facts needed to strengthen or disprove eligibility; never silently inferred.",
        (4, 7, 0): "applicationPlan", (4, 7, 1): "object", (4, 7, 2): "Yes", (4, 7, 3): "Evidence-linked tasks, owners, dependencies, due dates, status, and change-triggered regeneration history.",
        (5, 1, 0): "Duplicate dataset delivery", (5, 1, 1): "Return the existing run/version; do not emit duplicate change events or alerts.", (5, 1, 2): "Collection ID and hashes make raw archival and canonical publication idempotent.",
        (5, 2, 0): "Database write fails", (5, 2, 1): "Fail the run, retry within budget, and publish nothing from the partial transaction.", (5, 2, 2): "Readers continue on the last accepted version and operators see an explicit failure.",
        (5, 3, 0): "Bright Data or NIM timeout", (5, 3, 1): "Bounded retry; preserve prior data. AI degradation leaves deterministic discovery and evidence available.", (5, 3, 2): "Provider outages cannot become false closures, eligibility, or missing requirements.",
        (5, 4, 0): "Schema/policy changes mid-run", (5, 4, 1): "Finish against the pinned version; the next run adopts the approved version.", (5, 4, 2): "One run remains reproducible and never mixes extraction semantics.",
        (6, 1, 0): "Source freshness", (6, 1, 1): "99% of active sources checked within configured daily window; page if >2 hours late.", (6, 1, 2): "Data operations", (6, 1, 3): "Required",
        (6, 2, 0): "Discovery and chat latency", (6, 2, 1): "Discovery p95 <500 ms; first NIM response p95 <8 s over 30 minutes.", (6, 2, 2): "Application engineering", (6, 2, 3): "Recommended",
        (6, 3, 0): "Collection quality", (6, 3, 1): "Alert on zero rows, >30% volume drop, <95% required fields, or <95% date parse rate.", (6, 3, 2): "Data operations", (6, 3, 3): "Required",
        (6, 4, 0): "Evidence coverage", (6, 4, 1): "100% of eligibility states and displayed hard requirements cite at least one retained passage.", (6, 4, 2): "ML and product", (6, 4, 3): "Required",
        (6, 5, 0): "Expiry and replay integrity", (6, 5, 1): "Daily expired-record sweep; weekly sampled replay matches canonical hashes exactly.", (6, 5, 2): "Platform engineering", (6, 5, 3): "Required",
        (6, 6, 0): "Rollout constraint: run all sources in shadow mode, complete a broken-schema healing drill, review 100 sampled matches, and prove rollback before pilot alerts are enabled.",
        (7, 1, 0): "Official APIs and direct fetches", (7, 1, 1): "Lower latency and cost for some government data.", (7, 1, 2): "Rejected by product requirement: every web collection path must use Bright Data.",
        (7, 2, 0): "Broad web search index", (7, 2, 1): "Rapidly expands recall across disciplines and regions.", (7, 2, 2): "Weak source control, freshness guarantees, and passage-level reproducibility for launch.",
        (7, 3, 0): "LLM-only eligibility", (7, 3, 1): "Flexible interpretation of narrative requirements.", (7, 3, 2): "Unacceptable hallucination risk; hard constraints and evidence gates must be deterministic.",
        (7, 4, 0): "Fully automatic scraper healing", (7, 4, 1): "Fast recovery after layout changes.", (7, 4, 2): "Could silently alter semantics; launch requires proposal, review, approval, and same-Collector rerun.",
        (8, 1, 1): "US biomedical vertical slice: source registry, lab profile, feed, opportunity detail, evidence, and chat.", (8, 1, 2): "Unit/integration/e2e tests pass; no non-Bright-Data collection code is reachable.",
        (8, 2, 1): "20–40 Collectors, daily reevaluation, live events, alerts, and reviewed healing demonstration.", (8, 2, 2): "Recorded and live proofs show missing-field detection, approval, same-ID rerun, and corrected tasks.",
        (8, 3, 1): "Pilot with a small cohort of US biomedical labs and research startups.", (8, 3, 2): "Four-week freshness target met; zero unsupported verified-eligible conclusions in audited sample.",
        (8, 4, 1): "Expand source portfolio and adjacent US research domains under feature flags.", (8, 4, 2): "SLOs met, rollback rehearsed, security review complete, and source/domain owners assigned.",
    }

    with zipfile.ZipFile(OUTPUT, "r") as source:
        parts = {name: source.read(name) for name in source.namelist()}
    root = etree.fromstring(parts["word/document.xml"])
    body_paragraphs = root.xpath("./w:body/w:p", namespaces=NS)
    for index, value in paragraph_replacements.items():
        set_text(body_paragraphs[index], value)
    tables = root.xpath("./w:body/w:tbl", namespaces=NS)
    for (table_index, row_index, column_index), value in table_values.items():
        row = tables[table_index].xpath("./w:tr", namespaces=NS)[row_index]
        cell = row.xpath("./w:tc", namespaces=NS)[column_index]
        set_text(cell, value)
    cover_rows = tables[1].xpath("./w:tr", namespaces=NS)
    cover_rows[2].getparent().remove(cover_rows[2])
    for doc_property in root.xpath(".//wp:docPr", namespaces={"wp": WP_NS}):
        doc_property.set("title", "FundingSecured system architecture")
        doc_property.set("descr", "Funding sources flow through Bright Data Collectors, validation, evidence storage, matching, NVIDIA NIM chat, and operations with an evidence-gated safety boundary.")
    parts["word/document.xml"] = etree.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)

    footer = etree.fromstring(parts["word/footer1.xml"])
    set_text(footer, "FundingSecured | System Design RFC")
    parts["word/footer1.xml"] = etree.tostring(footer, xml_declaration=True, encoding="UTF-8", standalone=True)
    parts["word/media/image1.png"] = architecture_image()

    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED) as target:
        for name, data in parts.items():
            target.writestr(name, data)
    print(OUTPUT.resolve())


if __name__ == "__main__":
    main()
