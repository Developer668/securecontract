# SecureContract

> Public opportunities change. Your data should not break.

SecureContract is a self-healing, evidence-grounded public-procurement intelligence product. It is designed to turn structurally different public portals into one canonical opportunity stream while preserving what the government site and scraper actually said.

The repository contains the runnable product, PostgreSQL/Drizzle schema, collection and NIM provider integrations, deterministic validation/versioning, tests, custom Bright Data collector artifacts, and a truthful replay mode. The canonical replay currently contains 42,150 opportunities, including 42,140 open listings as of 2026-08-18, 1,565 Canadian listings, 938 US listings, 54 Australian listings, and 39,593 notices from the European Union's official TED API. A hard 99,000-record ceiling prevents unbounded browser and replay growth. Live collection through the product and live NVIDIA NIM inference are both verified.

## Why this exists

Procurement portals vary by jurisdiction, terminology, dates, pagination, and access behavior. A scraper failure can look like a real business event: zero rows may be mistaken for every contract closing. SecureContract creates a reliability boundary that archives raw rows, validates a run before publication, normalizes additively, stores field-level provenance, versions material changes, and preserves the last known-good state when extraction becomes unreliable.

```text
Government portals and official open-data feeds
   ↓ Bright Data collectors or registered public-source adapters
   ↓
Raw immutable data
   ↓
Validation
   ↓
Normalization + evidence
   ↓
SecureContract
   ├── Opportunity discovery
   ├── Change intelligence
   ├── Application workspace
   └── NVIDIA NIM copilot
```

## Product surfaces

- **Discover** — searchable canonical feed with dynamic country and source choices.
- **Opportunity detail** — Overview, Evidence, Changes, Raw, Workspace, and Copilot views.
- **Operations** — one-click collector runs, current validation, compact integration readiness, and an expandable self-healing ledger.
- **Workspace** — preparation status, tasks, notes persistence, and explicit readiness boundaries.
- **Copilot** — a dedicated NVIDIA NIM studio scoped to the selected opportunity's collected evidence.

The frontend never hardcodes a country union or routes by country. A `SourceConfig.adapterKey` selects a source adapter. The unit suite proves an arbitrary Brazil source flows through the same model without UI changes.

## Raw → canonical → evidence

```text
PUBLIC WEBSITE
  ↓ Bright Data custom collector
RAW      closing_date_raw = "26-Aug-2026 17:00"
  ↓ source adapter + configured timezone
CANONICAL submissionDueAt = "2026-08-26T17:00:00+05:30"
  ↓
EVIDENCE  rawLabel + rawValue + normalizedValue + sourceUrl + observedAt
  ↓
PRODUCT   deadline + change alert + application task + grounded copilot context
```

Raw records are append-only in the database model. Volatile observation metadata is excluded from canonical hashes. Critical changes such as submission deadlines, mandatory meetings, cancellations, and eligibility restrictions cannot disappear into an overwrite.

## Reliability behavior

Run validation covers zero rows, volume collapse, required-field completeness, date parse rate, duplicate rate, schema drift, access-wall detection, and freshness. Health is deterministic: 30% completeness, 25% date parsing, 20% volume stability, 15% schema stability, and 10% freshness.

Discover defaults to open opportunities. Public-source scrapers discard rows whose source status is not open or whose parsed submission deadline has passed. Previously collected records are retained for evidence, but their canonical status automatically becomes `closed` once the deadline passes and the transition appears in the change history.

When a run is rejected, SecureContract does not replace accepted opportunities or infer that missing rows are closed. The UI explicitly displays `LAST KNOWN GOOD` and the reason the latest source run is degraded.

## Bright Data Scraper Studio

`BrightDataClient` implements the current official flow:

1. `POST /dca/trigger?collector=c_…&queue_next=1`
2. persist the returned `collection_id` as the run/snapshot identifier;
3. poll `GET /dca/dataset?id=j_…` with bounded exponential backoff;
4. archive rows before validation and normalization.

The Bright Data token is never sent to the browser. A user can run every configured source from Operations without a second login; the same-origin server performs the collection and keeps provider credentials private. Cron remains protected by `CRON_SECRET`. Source URLs are restricted to public HTTP(S) targets and reject embedded credentials, localhost, and private-network IPs.

CanadaBuys, Québec SEAO, EU TED, Texas DOT, Los Angeles RAMP, New York City, Montgomery County, San Francisco, and Chicago use official anonymous CSV, JSON, OCDS, or HTML endpoints because Scraper Studio rejected or failed generation for several government domains. TED uses the official 250-notice iteration cursor to collect the complete current open result set while the application enforces its 99,000-record ceiling. These sources still pass through the same archive, validation, normalization, evidence, and last-known-good pipeline. Chicago's live page is currently unavailable, so its source is warning-only and its last accepted rows are preserved rather than represented as freshly collected.

Current proof status is documented in [docs/bright-data-proof.md](docs/bright-data-proof.md). No Collector ID is fabricated. The self-healing evidence protocol is in [docs/healing-proof.md](docs/healing-proof.md).

## NVIDIA NIM copilot

SecureContract Copilot is an interpretation studio inside an opportunity, not a generic chatbot. The server sends a minimal context pack containing canonical fields, field evidence, source health, changes, and optional user-provided vendor facts. Its rules require explicit missing-data language and canonical evidence references. Unsupported citations are removed at the server boundary. It cannot claim legal eligibility, guarantee compliance, predict win probability, invent certifications, or submit a bid.

Production returns `NVIDIA NIM not configured` when the key is absent. The assistant lists the full authenticated NVIDIA catalog, separated into fast/non-reasoning and reasoning choices. Catalog entries are not a promise of account entitlement, so an unavailable selection preserves the retrieved official evidence and falls back safely instead of fabricating an answer. Tests mock only network transport; production never returns a fake AI answer. See [docs/nvidia-nim.md](docs/nvidia-nim.md).

## Database

The Drizzle PostgreSQL schema in `db/schema.ts` includes:

```text
sources · source_runs · raw_records
opportunities · opportunity_versions · opportunity_changes · field_evidence
documents · amendments
vendor_profiles · application_workspaces · application_tasks
copilot_threads · copilot_messages
```

## Local setup

Requirements: Node 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:8787` and Vite proxies `/api` during development.

Optional live configuration:

```env
DATABASE_URL=
BRIGHT_DATA_API_TOKEN=
NVIDIA_API_KEY=
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
CRON_SECRET=
BRIGHT_DATA_CREDENTIALS_PATH=
DEMO_MODE=recorded-live
```

Never put these values in client-prefixed environment variables. The checked-in `.env.example` contains names only.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm replay:build
pnpm verify:nim

pnpm tsx scripts/onboard-source.ts https://public.example.gov/tenders
pnpm tsx scripts/collect-source.ts c_collector https://public.example.gov/tenders
pnpm tsx scripts/validate-source.ts run-metrics.json
```

Build the evidence replay with `pnpm replay:build`. It preserves artifact-level provenance: completed dataset runs, approved extraction previews, and rejected runs remain distinct.

In **Operations**, click **Run all live sources**. In Discover, **Find more opportunities** refreshes every active official public source without requiring a second login. SecureContract publishes only after each run passes validation. AAI is an auxiliary publication index and is deliberately archived without being published as a contract opportunity.

## Project map

```text
src/App.tsx                 product UI and workflows
src/data/demo.ts            explicitly labeled demonstration fixtures
src/lib/bright-data/        live trigger/retrieval client
src/lib/sources/            source adapter interface and registry
src/lib/validation.ts       deterministic run acceptance
src/lib/normalization.ts    status/procedure/hash/diff behavior
src/lib/ai/                 grounded context and NVIDIA provider
server/index.ts             server API and one-click collection orchestration
db/schema.ts                PostgreSQL + Drizzle tables
tests/                      unit, integration, and browser E2E
docs/                       architecture and proof ledgers
```

## Deployment

Build the static client with `pnpm build` and run the server in a Node environment with its secrets configured. Provision PostgreSQL and apply the Drizzle schema before enabling persistence-backed live mode. Set `APP_URL` and `CRON_SECRET` as GitHub repository secrets for `.github/workflows/collect.yml`. Collection frequency is deliberately conservative (every 12 hours).

Do not deploy demonstration or preview-replay mode as a live-data claim. A production release gate must require accepted per-opportunity dataset runs, sanitized recorded-live output, a completed healing ledger, and a live NIM inference.

## Hackathon documentation

- [Architecture](docs/architecture.md)
- [Source selection](docs/source-selection.md)
- [Bright Data proof ledger](docs/bright-data-proof.md)
- [Healing proof ledger](docs/healing-proof.md)
- [NVIDIA NIM integration](docs/nvidia-nim.md)
- [Demo script](docs/demo-script.md)
- [Release readiness ledger](docs/release-readiness.md)
- [Generated product design spec](docs/design/securecontract-concept.png)
- [Latest desktop implementation](docs/design/implementation-desktop.png)
- [Safari verification with completed live data](docs/design/implementation-desktop-live.jpeg)
- [Safari verification with live NVIDIA NIM](docs/design/nvidia-nim-live.jpeg)
- [Latest mobile implementation](docs/design/implementation-mobile.png)

## AI-development disclosure

OpenAI Codex was used extensively as a development agent during the hackathon. The participant reviewed, tested and verified the resulting implementation, scraper behavior and architectural decisions.

## Safety boundary

SecureContract only targets public procurement information. It does not collect bidder personal data, authenticate to restricted portals, bypass access controls, accept legal terms, sign agreements, or submit bids automatically.
