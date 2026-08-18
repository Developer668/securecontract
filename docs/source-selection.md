# Source selection log

Checked 2026-08-17. All candidates below expose public procurement information without requiring SecureContract to log in or collect bidder data. An exact-name search of Bright Data's public dataset pages did not surface a matching prebuilt dataset for the selected agency portals. The authenticated Scrapers dashboard was also cross-checked after collector creation and showed the accepted ASL and CCA collectors with delivered records.

| Source | Country / jurisdiction | Public URL | Public-access result | Available fields | Decision / collector result |
|---|---|---|---|---|---|
| India CPPP | India / national | https://eprocure.gov.in/eprocure/app | Public homepage, but downstream paths may use CAPTCHA | title, reference, closing/opening dates, organisation | Rejected for this build: Scraper Studio AI flow returned `Domain not allowed` (`c_msxukjl31m70b2fqtg`) |
| Tamil Nadu eProcurement | India / state | https://tntenders.gov.in/nicgep/app | Public homepage | title, reference, dates | Rejected: `Domain not allowed` (`c_msxul4zc1q8jah39gn`) |
| Government eTenders | India / national | https://etenders.gov.in/eprocure/app | Public current listings | title, reference, dates, organisation | Rejected: `Domain not allowed` (`c_msxuy1kgbyfllswvz`) |
| Airports Authority of India tender-status publications | India / agency | https://www.aai.aero/en/corporate/status-of-tenders-contracts | Public, no login/paywall; links public monthly procurement PDFs | publication title/category, upload date, document URL | Accepted as operational/healing proof; not promoted to per-opportunity feed |
| Tenders Victoria | Australia / Victoria | https://www.tenders.vic.gov.au/tenders/open | Public listing | RFx, title, issuer, dates | Rejected: `Domain not allowed` (`c_msxunx2h2ekejhyfx7`) |
| Buy NSW | Australia / NSW | https://buy.nsw.gov.au/opportunity/search/ | Public search | title, buyer, type, dates | Rejected: `Domain not allowed` (`c_msxuo8sq913jl9e0q`) |
| City of Sydney TenderLink | Australia / municipality | https://portal.tenderlink.com/cityofsydney | Public official external portal, no login needed for summary list | reference, type, title, closing date, URL | Generation timed out; collector remained without template (`c_msxuvgj92j79wbuork`) |
| Brisbane City Council | Australia / municipality | https://www.brisbane.qld.gov.au/business/council-tenders-and-market-led-proposals/current-tenders | Public released-tenders table; documents require supplier portal | RFx, title, description, category, type, close date | Rejected: `Domain not allowed` (`c_msxvbeey1x5cco7wm0`) |
| Orange County OpenGov | United States / California county | https://procurement.opengov.com/portal/ocgov | Public opportunity portal | ID, title, department, type, dates | AI generation failed during preview selection (`c_msxurdfmqlqxawu0d`) |
| Lake County CivicEngage | United States / California county | https://www.lakecountyca.gov/Bids.aspx | Public bid postings | bid number, title, status, closing date | Rejected: `Domain not allowed` (`c_msxv5com25h9ygplig`) |
| California Community Choice Association | United States / California agency | https://ccauthority.org/bid-opportunites/ | Public recent solicitations table; registration applies only to linked bid packets | project, site, location, dates, status | Fresh collector `c_msxy8dx318cy3aekq5` created, run, healed with approval, rerun, and accepted as one canonical row |
| Australian Sustainability Leaders | Australia / national program | https://asl.org.au/tenders | Public tender cards | title, type, status, opening/closing dates, URL | Fresh custom collector `c_msxxrkb9zckaljn0a` created successfully; dataset run recorded separately in the proof ledger |

Rejection is recorded rather than hidden: a half-built Collector ID or extraction preview is not an accepted live source, and no failed candidate is represented as completed live data.
