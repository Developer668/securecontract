# FundingSecured

Funding discovery and application planning for early-stage US biomedical labs and research-driven startups that do not have a dedicated grant administrator.

FundingSecured combines a responsive evidence-first dashboard, a portfolio-wide NVIDIA NIM funding guide, a live change feed, and a Bright Data-only collection plane. It is deliberately conservative: a missing eligibility passage remains missing, an expired deadline closes automatically, and every consequential recommendation links back to retained source evidence.

## What the product does

- Ranks US biomedical funding by research, institution, team stage, equipment, funding range, collaboration preference, and commercialization stage.
- Uses four bounded eligibility states: `verified_eligible`, `likely_confirmation_required`, `insufficient_evidence`, and `not_eligible`.
- Shows score explanations, amounts, deadlines, required partners, relevant capabilities, missing information, collected source passages, and application tasks.
- Provides a central natural-language query box and a dedicated ChatGPT-style Funding Guide.
- Streams collection and change events through server-sent events.
- Re-evaluates deadlines on every read and closes expired opportunities without model judgment.
- Runs 24 US biomedical source searches with Bright Data only; richer server-managed Collectors are used where Bright Data permits direct collection.
- Preserves the last accepted records when a Collector returns zero complete rows.

Discovery begins empty. A user must save a lab profile and run the source portfolio before records or match scores appear.

## Architecture

```text
US biomedical funding pages
        ↓
Bright Data custom Collectors or Bright Data SERP collection
        ↓
raw dataset → quality gate → canonical opportunity + exact passages
        ↓
FundingSecured API
   ├── discovery and live events
   ├── lab profile and tasks
   ├── evidence-bounded NVIDIA NIM guide
   └── one-click source operations and healing workflow
        ↓
responsive React interface
```

The server retains both provider secrets. Browser code receives neither the Bright Data token nor the NVIDIA key. NIM output is parsed as structured JSON, and cited evidence/opportunity IDs are allow-listed against the context supplied to the model.

## Local setup

Requirements: Node.js 20+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:5173`. The API listens at `http://localhost:8787` and Vite proxies `/api` during development.

```env
BRIGHT_DATA_API_TOKEN=
BRIGHT_DATA_CREDENTIALS_PATH=
NVIDIA_API_KEY=
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_MODEL=meta/llama-3.1-8b-instruct
DATABASE_URL=
CRON_SECRET=
```

The existing server-side NVIDIA NIM environment variables are reused. Never expose either provider key through a client-prefixed variable.

## Bright Data workflow

1. Open **Sources** and click **Run** or **Run all ready sources**. No IDs or credentials are requested in the browser.
2. The server uses its approved custom Collector for a source when one is configured.
3. Otherwise it discovers that source's funding pages through Bright Data's SERP API. This is particularly important for government domains that Bright Data may decline to collect directly under its domain policy.
4. FundingSecured normalizes only rows containing a title and a URL on the requested source domain.
5. Missing deadlines and eligibility stay explicitly missing; search snippets never produce a verified-eligible result.
6. Zero complete rows fail the gate and preserve last-known-good data.

All Bright Data credentials and custom Collector IDs remain server-side.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify:nim

pnpm scraper:run c_collector https://example.org/funding
```

## Project map

```text
src/App.tsx                         product UI and workflows
src/styles.css                     responsive high-end visual system
src/data/funding-demo.ts           24-source US biomedical registry
src/lib/funding-ingestion.ts       Bright Data funding normalization
src/lib/bright-data/               Collector trigger and dataset client
src/lib/ai/funding-provider.ts     evidence-bounded NVIDIA NIM guide
server/index.ts                     API, SSE, Collector orchestration
tests/                              unit, integration, and browser checks
docs/fundingsecured-system-design/ generated system-design artifact
```

## Safety boundary

FundingSecured is decision support, not an eligibility authority. It does not invent requirements, guarantee eligibility, submit applications, bypass access controls, or collect through any provider other than Bright Data. Users must verify the linked official notice before acting.
