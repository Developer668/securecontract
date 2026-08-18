# SecureContract engineering notes

- Country and jurisdiction are data. Never branch application behavior on known country names.
- A source adapter is the integration boundary.
- Raw records are immutable. Normalization is additive and evidence-backed.
- Reject anomalous runs before canonical publication; preserve last-known-good data.
- Never represent demonstration fixtures as live or recorded-live data.
- Bright Data and NVIDIA credentials are server-only and must never enter logs or browser bundles.
- The copilot interprets canonical context; it never becomes the source of truth.

## Bright Data collectors

Use these existing Scraper Studio collectors. Do not rebuild them in a new session:

- Australian Sustainability Leaders tenders: `c_msxxrkb9zckaljn0a` (canonical opportunity feed)
- California Community Choice Association procurement: `c_msxy8dx318cy3aekq5` (canonical opportunity feed)
- Airports Authority of India publication index: `c_msxulljug99b25hby` (auxiliary/healing proof only; never publish as contract opportunities)

Run collectors with the one-click **Run all live sources** action in SecureContract's Operations view. The server keeps credentials private while raw archival, validation, normalization, and last-known-good protection execute. Use `npx -p @brightdata/cli bdata login` only to establish or refresh the local CLI session; credentials must remain outside the repository.

The CanadaBuys and Québec SEAO feeds plus Texas DOT, Los Angeles RAMP, NYC, Montgomery County, and San Francisco open-data APIs are registered public-source collectors. They have no fabricated Bright Data Collector IDs and run through the same validation and publication boundary. The canonical replay and API are capped at 99,000 opportunities. The Chicago source is warning-only while its official endpoint is unavailable; preserve its last-known-good data.
