# FundingSecured

Funding discovery and application planning for early-stage US biomedical labs and research-driven startups that do not have a dedicated grant administrator.

FundingSecured combines a responsive evidence-first dashboard, a portfolio-wide NVIDIA NIM funding guide, a live change feed, and a Bright Data-only collection plane. It is deliberately conservative: a missing eligibility passage remains missing, an expired deadline closes automatically, and every consequential recommendation links back to retained source evidence.

## What the product does

- Ranks US biomedical funding by research, institution, team stage, equipment, funding range, collaboration preference, and commercialization stage.
- Uses four bounded eligibility states: `verified_eligible`, `likely_confirmation_required`, `insufficient_evidence`, and `not_eligible`.
- Shows score explanations, amounts, deadlines, required partners, relevant capabilities, missing information, exact source passages, and application tasks.
- Provides a central natural-language query box and a dedicated ChatGPT-style Funding Guide.
- Streams collection and change events through server-sent events.
- Re-evaluates deadlines on every read and closes expired opportunities without model judgment.
- Connects and runs only real Bright Data Collector IDs. There is no direct HTML/API scraper fallback.
- Preserves the last accepted records when a Collector returns zero complete rows.

The checked-in opportunity set is a labeled product demonstration. It is not represented as live Bright Data output. Connect verified Collector IDs in the **Collectors** view to publish live records.

## Architecture

```text
US biomedical funding pages
        ↓
Bright Data Collectors only
        ↓
raw dataset → quality gate → canonical opportunity + exact passages
        ↓
FundingSecured API
   ├── discovery and live events
   ├── lab profile and tasks
   ├── evidence-bounded NVIDIA NIM guide
   └── Collector operations and healing workflow
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

1. Create and validate a funding-page scraper in Bright Data Scraper Studio.
2. Open **Collectors** and connect the returned `c_…` Collector ID to its source.
3. Run it from the product. The server triggers the Collector and polls the returned collection ID.
4. FundingSecured normalizes only rows containing a title and official detail URL.
5. Zero complete rows fail the gate and preserve last-known-good data.
6. For the healing demo, review a missing-field extraction proposal in Bright Data, approve it, and rerun the same Collector ID.

No Collector IDs are fabricated in the demonstration state.

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
src/data/funding-demo.ts           labeled US biomedical demo portfolio
src/lib/funding-ingestion.ts       Bright Data funding normalization
src/lib/bright-data/               Collector trigger and dataset client
src/lib/ai/funding-provider.ts     evidence-bounded NVIDIA NIM guide
server/index.ts                     API, SSE, Collector orchestration
tests/                              unit, integration, and browser checks
docs/fundingsecured-system-design/ generated system-design artifact
```

## Safety boundary

FundingSecured is decision support, not an eligibility authority. It does not invent requirements, guarantee eligibility, submit applications, bypass access controls, or scrape through any path other than configured Bright Data Collectors. Users must verify the linked official notice before acting.
