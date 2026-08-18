# Real Self-Healing proof

Date: 2026-08-17  
Source: Airports Authority of India tender-status publications  
Collector before: `c_msxulljug99b25hby`  
Collector after: `c_msxulljug99b25hby`

## Observed failure

The real baseline run returned 234 rows. Every row contained a PDF URL, but every nested `publications` array was empty. SecureContract therefore classified the requested publication schema as unusable rather than presenting it as valid procurement data.

## Focused heal request

> The baseline run returned 234 PDF URLs but every publications array was empty, so the requested publication metadata is unusable. Fix the collector to return one flat record per publicly listed tender-status publication on the page with publication_title, document_upload_date_raw, document_url, publication_category, and source_url. Do not crawl inside PDFs, do not collect personal data, and keep the same Collector ID.

## Review and approval

The CLI stopped at `awaiting_approval`. Its preview contained real flat rows such as `Tender Published in June 2026`, upload date `29-07-2026`, and the official AAI PDF URL. The proposal summarized one template-step change. After this review, the change was explicitly approved with `bdata scraper approve … --auto-save`.

## Post-heal verification

The rerun completed with 234 flat records. Required fields are present in the sampled rows and the Collector ID is unchanged. This is a truthful extraction repair; it is not described as a website redesign.

| Check | Result |
|---|---|
| Baseline preserved | PASS |
| Focused heal request preserved | PASS |
| Preview reviewed before approval | PASS |
| Explicit approval | PASS |
| Same Collector ID | PASS |
| Post-heal rerun | PASS |
| Post-heal rows | 234 |

Artifacts are stored under `fixtures/recorded-live/india-aai/`. They contain public procurement-publication metadata only and no tokens, cookies, or personal bidder information.
