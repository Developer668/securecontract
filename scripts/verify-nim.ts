import { readFileSync } from "node:fs";
import { NvidiaNimProvider } from "../src/lib/ai/nvidia/provider.js";
import type { Opportunity } from "../src/types.js";

const apiKey = process.env.NVIDIA_API_KEY;
const baseUrl = process.env.NVIDIA_NIM_BASE_URL;
const model = process.env.NVIDIA_NIM_MODEL;
if (!apiKey || !baseUrl || !model) {
  throw new Error("NVIDIA_API_KEY, NVIDIA_NIM_BASE_URL, and NVIDIA_NIM_MODEL are required");
}

const opportunities = JSON.parse(
  readFileSync("fixtures/recorded-live/replay-opportunities.json", "utf8"),
) as Opportunity[];
const opportunity = opportunities[0];
if (!opportunity) throw new Error("Recorded-live opportunity fixture is empty");

const result = await new NvidiaNimProvider({ apiKey, baseUrl, model }).chat({
  opportunity,
  question:
    "What is the submission deadline, current status, and what should I verify before deciding whether to apply?",
});

if (result.evidenceFields.length === 0) {
  throw new Error("Live NIM response did not cite collected evidence");
}

console.log(
  JSON.stringify({
    ok: true,
    model,
    opportunity: opportunity.titleOriginal,
    evidenceFields: result.evidenceFields,
    draft: result.draft,
  }),
);
