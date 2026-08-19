# Bright Data proof ledger

The Bright Data CLI was authenticated and verified on 2026-08-17 with `@brightdata/cli` 0.3.5. Tokens, cookies, and account identifiers are not stored in this repository.

## Collector ledger

| Source | Input URL | Collector ID | Result | Rows | Fields returned | Limitations |
|---|---|---|---|---:|---|---|
| Airports Authority of India tender-status publications | https://www.aai.aero/en/corporate/status-of-tenders-contracts | `c_msxulljug99b25hby` | Completed post-heal run, 2026-08-17 | 234 | publication title, upload date, document URL, category, source URL | Publication index, not one row per underlying tender; intentionally excluded from canonical opportunity feed |
| Australian Sustainability Leaders tenders | https://asl.org.au/tenders | `c_msxxrkb9zckaljn0a` | Completed run, response `d2t1787014014069rrj38shevv9o` | 4 | title, type, status, open/closing dates, detail/source URL | Raw closing text includes a later phase label; the adapter preserves it and parses the leading timestamp |
| California Community Choice Association procurement | https://ccauthority.org/bid-opportunites/ | `c_msxy8dx318cy3aekq5` | Completed post-heal run, response `d2t1787014744903r0r6ggh7kkeg` | 1 | project ID/title, site, location, status, optional dates, URLs | Bright still returned a nested wrapper after same-ID heal; SecureContract archives it unchanged, then flattens it at the adapter boundary |
| VendorPanel Australian public tenders | https://www.vendorpanel.com.au/PublicTenders.aspx | `c_msyxk9sd1olj4rz9i9` | Completed run, response `d2t1787074248760rm202d7du50g` | 50 | title, buyer, open status, closing date, detail page URL | Dataset archives one tender per page wrapper; SecureContract flattens only after immutable archival |
| MERX Canadian open bids | https://www.merx.com/public/solicitations/open-bids | `c_msywoiwt25k5frwn95` | Completed crawl plus same-ID healing attempts | 175 identity-complete pre-heal; 201 rejected post-heal | listing title, solicitation IDs, detail URLs; 41 explicit open statuses | Identity-complete pre-heal rows are retained as Bright Data review records; missing status/deadlines remain unknown, while the shifted post-heal batch stays rejected |

CanadaBuys and City of Chicago were also attempted in Scraper Studio. CanadaBuys generation failed twice and Chicago returned `Domain not allowed`; the repository preserves those creation envelopes. Fresh 2026-08-18 attempts for AusTender (`c_msyvb8wtuav1vzclp`) and South Australia (`c_msyvetvrdnfw4nctu`) were likewise rejected as `Domain not allowed`, and their envelopes are retained without representing either as collected data. SecureContract therefore collects official anonymous government feeds with registered public-source adapters rather than inventing Collector IDs. CanadaBuys produced 882 valid open rows, Québec SEAO 700, Texas DOT 342, Los Angeles RAMP 391, NYC 89, Montgomery County 13, San Francisco 86, and the TED iteration API returned 39,593 current open notices. Chicago is warning-only while its endpoint is unavailable.

The first baseline returned 234 document URLs with empty nested `publications` arrays. This was archived as a failed extraction, repaired with the real Self-Healing flow, explicitly reviewed/approved, and rerun successfully under the same Collector ID. See [healing-proof.md](healing-proof.md).

## Artifacts

- `fixtures/recorded-live/india-aai/baseline.json` — rejected pre-heal raw output
- `fixtures/recorded-live/india-aai/heal-proposal.json` — approval-gate envelope and preview rows
- `fixtures/recorded-live/india-aai/heal-approval.json` — completed approval envelope
- `fixtures/recorded-live/india-aai/post-heal.json` — 234 corrected raw rows
- `fixtures/recorded-live/australia-asl/create-v3.json` — successful fresh custom collector creation envelope
- `fixtures/recorded-live/australia-asl/run-v3.json` — completed 4-row dataset output
- `fixtures/recorded-live/australia-austender/create.json` — rejected `Domain not allowed` creation envelope
- `fixtures/recorded-live/australia-sa/create.json` — rejected `Domain not allowed` creation envelope
- `fixtures/recorded-live/australia-asl/heal-proposal.json` — actual Scraper Studio extraction preview
- `fixtures/recorded-live/australia-vendorpanel/create.json` — successful Australian collector creation
- `fixtures/recorded-live/australia-vendorpanel/run-live.json` — completed 50-page Australian dataset
- `fixtures/recorded-live/canada-merx/create.json` — successful Canadian collector creation
- `fixtures/recorded-live/canada-merx/run-live.json` — 175-row Bright Data crawl retained after identity validation (missing status/deadline fields remain unknown)
- `fixtures/recorded-live/canada-merx/heal-proposal.json` — first reviewed same-ID repair proposal
- `fixtures/recorded-live/canada-merx/heal-approval.json` — explicit first repair approval
- `fixtures/recorded-live/canada-merx/post-heal.json` — rejected 201-row full post-heal batch
- `fixtures/recorded-live/canada-merx/heal-2-proposal.json` — second same-ID repair attempt; timed out after the bounded 900-second validation window
- `fixtures/recorded-live/california-cca/heal-proposal.json` — actual Scraper Studio extraction preview
- `fixtures/recorded-live/california-cca/create-v3.json` — successful fresh collector creation
- `fixtures/recorded-live/california-cca/run-v3.json` — completed pre-heal nested dataset
- `fixtures/recorded-live/california-cca/heal-v3-proposal.json` — reviewed same-ID flattening proposal
- `fixtures/recorded-live/california-cca/heal-v3-approval.json` — explicit approval envelope
- `fixtures/recorded-live/california-cca/post-heal-v3.json` — completed post-heal dataset; nested deployment behavior preserved truthfully
- `fixtures/recorded-live/replay-manifest.json` — generated provenance and acceptance ledger

## Runtime integration

`BrightDataClient` uses the server-side Scraper Studio API:

1. `POST /dca/trigger?collector=c_…&queue_next=1`
2. persist `collection_id` as a source run;
3. poll `GET /dca/dataset?id=…`;
4. archive raw rows before validation;
5. publish canonical versions only when deterministic validation accepts the run.

The authenticated Safari dashboard was cross-checked again on 2026-08-17. The Scrapers page loaded successfully and showed the same named custom collectors: CCA active with two cumulative records and ASL ready with eight cumulative records. These dashboard totals are cumulative deliveries; SecureContract's latest accepted datasets remain one CCA row and four ASL rows.

## SecureContract API verification

The application's one-click Operations route triggered the active ASL collector again on 2026-08-17 and received snapshot `j_msy4j0l9bqiyc52df`. SecureContract polled for roughly 90 seconds, archived the raw rows, and accepted 4/4 rows with score 100: 100% required-field completeness, 100% date parsing, zero duplicates, and no access wall. The newest run and opportunity `lastSeenAt` values were visible immediately in Operations and the feed.
