# NVIDIA NIM integration

`NvidiaNimProvider` uses NVIDIA's OpenAI-compatible server API. `NVIDIA_API_KEY` is read only by the server. The browser receives a truthful `NVIDIA NIM not configured` response when the key is absent. The chat model picker loads the authenticated catalog, groups fast/non-reasoning and reasoning choices, and does not assume catalog visibility means every model is callable. Production never returns mocked copilot content; tests mock only HTTP transport.

The prompt requires JSON output, evidence field references, explicit missing-data language, and the `Draft — verify before submission` boundary. Citations are normalized case-insensitively to their canonical names and anything outside the collected evidence set is discarded before the browser receives the response. The context builder excludes unrelated records and contains no arbitrary database access.

## Live verification

The assistant loads the authenticated NVIDIA model catalog and groups it into fast/non-reasoning and reasoning options. Catalog visibility does not guarantee that every model is enabled for every NVIDIA account, so an unavailable selection safely falls back to deterministic, evidence-backed retrieval rather than inventing an answer. `NVIDIA_NIM_MODEL` controls the default selection; this workspace uses `meta/llama-3.1-8b-instruct`.

Run `pnpm verify:nim` to repeat the server-side verification. Launch and verification scripts load git-ignored `.env.local` and then the optional `.env.nim.local` override, so provider credentials remain server-only. Requests have a 45-second timeout and responses must pass Zod structure and evidence-citation validation before reaching the browser.
