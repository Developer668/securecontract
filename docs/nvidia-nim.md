# NVIDIA NIM integration

`NvidiaNimProvider` uses the OpenAI-compatible server API and a configurable model. `NVIDIA_API_KEY` is read only by the server. The browser receives a truthful `NVIDIA NIM not configured` response when either key or model is absent. Production never returns mocked copilot content; tests mock only HTTP transport.

The prompt requires JSON output, evidence field references, explicit missing-data language, and the `Draft — verify before submission` boundary. Citations are normalized case-insensitively to their canonical names and anything outside the collected evidence set is discarded before the browser receives the response. The context builder excludes unrelated records and contains no arbitrary database access.

## Live verification

Live verification passed on 2026-08-17 using `meta/llama-3.1-8b-instruct` through NVIDIA's hosted NIM API. The authenticated models endpoint, direct provider request, SecureContract `/api/copilot` route, and Safari application workflow all passed. The final response recommended checking the official solicitation, cited `titleOriginal`, `status`, `procedureType`, and `submissionDueAt`, and remained visibly marked as a draft.

Run `pnpm verify:nim` to repeat the server-side verification with a git-ignored `.env.local`. Requests have a 45-second timeout and responses must pass Zod structure and evidence-citation validation before reaching the browser.
