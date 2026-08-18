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

The CanadaBuys daily open-tender CSV (`canada-canadabuys`) and City of Chicago active-solicitation page (`us-chicago-solicitations`) are registered public-source collectors. They have no fabricated Bright Data Collector IDs: Scraper Studio rejected or failed generation for those government domains, so SecureContract runs their anonymous official feeds directly through the same validation and publication boundary.
