# Architecture

```text
Public procurement portals
  → custom Bright Data Scraper Studio collectors
  → immutable raw_records
  → row + run validation
  → source adapter registry
  → canonical opportunities + field_evidence
  → versions + classified changes
  → opportunity UI + application workspace
  → grounded NVIDIA NIM interpretation
```

The PostgreSQL/Drizzle schema is in `db/schema.ts`. Sources own portal metadata and an `adapterKey`; country is never an application branch. The runtime collection client uses bounded polling around Bright Data's `POST /dca/trigger` and `GET /dca/dataset` endpoints. A run must pass deterministic validation before replacing canonical state. When it fails, the prior canonical version remains active and the UI identifies it as last known good.

The NIM provider receives a minimal context pack containing canonical fields, evidence, changes, health, and optional user-supplied vendor facts. It has no arbitrary database or browsing tool.
