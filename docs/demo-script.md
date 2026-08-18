# SecureContract demo video runbook

## Before recording

Use a 1920×1080 browser window, increase terminal text to at least 18px, hide notifications, and close unrelated tabs. Start from a clean terminal in the repository:

```bash
pnpm install
DEMO_MODE=recorded-live pnpm dev
```

Open `http://localhost:5173`. Confirm Discover shows 7,000+ accepted opportunities and defaults to `Open`. Keep a second terminal ready for the scraper and healing proof.

## Recommended five-minute story

### 0:00–0:35 — Problem and scale

Say: “Public procurement portals have different schemas and can silently break. SecureContract turns official sources into one evidence-backed feed and refuses bad scraper runs.” Show the coverage banner and result count, then filter Country to Canada and United States. Mention that the repository enforces a hard 99,000-record ceiling.

### 0:35–1:20 — Run a real scraper from the terminal

Run one quick official source, then rebuild the replay:

```bash
pnpm scraper:run us-los-angeles-ramp
pnpm replay:build
```

Explain the output: the first command downloads the current official feed and saves the raw fixture; the second archives, validates, normalizes, deduplicates, and publishes only accepted rows. For a Canadian example use:

```bash
pnpm scraper:run canada-quebec-seao
```

For the real Bright Data collector use:

```bash
npx -p @brightdata/cli bdata scraper run c_msxxrkb9zckaljn0a https://asl.org.au/tenders --pretty -o asl-live.json
```

Never put API tokens on screen. Authenticate beforehand with `npx -p @brightdata/cli bdata login`.

### 1:20–2:00 — One-click product collection

Open **Operations** and click **Run all live sources**, or return to Discover and click **Find more opportunities**. Explain that no admin form is required: the server runs active official adapters and Bright Data collectors, archives raw rows first, validates the run, and preserves last-known-good data when a source fails.

### 2:00–2:50 — Evidence and self-healing

Run `pnpm self-heal:demo`. This prints the recorded AAI sequence: rejected baseline → reviewed proposal → explicit approval → 234-row post-heal verification under the same Collector ID. In Operations expand **verified scraper repairs** and show the same evidence visually.

For a real regression on a disposable or genuinely broken collector, use the review-first flow:

```bash
npx -p @brightdata/cli bdata scraper heal <collector_id> "The observed field is empty. Restore one flat row per listing with title, closing date, status, and official detail URL; do not collect contact or bidder data." --url <public_url> --pretty -o heal-proposal.json
npx -p @brightdata/cli bdata scraper approve <collector_id> --auto-save --url <public_url> --pretty -o heal-approval.json
npx -p @brightdata/cli bdata scraper run <collector_id> <public_url> --pretty -o post-heal.json
```

Pause after `heal`. Read the proposed changes and preview before running `approve`. Do not heal a healthy production collector just for theater; use the checked-in proof flow unless an actual regression exists.

### 2:50–3:35 — Trace one opportunity

Open a result, then show **Evidence** and **Raw**. Point from the canonical deadline back to `closing_date_raw`, the observed timestamp, and the official URL. Open **Changes** and explain that deadline/status changes become versioned alerts instead of silent overwrites.

### 3:35–4:25 — Tasks and application workspace

Open **Workspace** inside the opportunity. Change the application status to `Reviewing`, complete one existing task, add a concrete note such as “Confirm insurance threshold in the official bid package,” add another task, and save. Explain that the workspace is preparation support only: SecureContract does not submit bids or claim eligibility.

### 4:25–5:00 — Grounded copilot and close

Open **Copilot** and ask: “What must I verify before deciding whether to bid?” Show the draft label and evidence chips. Close with: “New jurisdictions are configuration and adapters, not new UI branches; unhealthy runs cannot erase trusted opportunities.”

## Recording rules

- Call a source “live” only when the proof ledger identifies a completed dataset run.
- Label creation failures and healing proposals exactly; never present them as accepted listings.
- Do not display `.env.local`, tokens, cookies, account IDs, personal contacts, or bidder data.
- Keep the official-source detail URL visible when discussing provenance.
- Record the final browser pass only after `pnpm test`, `pnpm test:e2e`, and `pnpm build` pass.
