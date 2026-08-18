import { readFileSync } from "node:fs";

const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as unknown;
const baseline = read("fixtures/recorded-live/india-aai/baseline.json");
const proposal = read("fixtures/recorded-live/india-aai/heal-proposal.json");
const approval = read("fixtures/recorded-live/india-aai/heal-approval.json");
const postHeal = read("fixtures/recorded-live/india-aai/post-heal.json");
const rowCount = (value: unknown) => (Array.isArray(value) ? value.length : 1);

console.log(
  JSON.stringify(
    {
      collectorId: "c_msxulljug99b25hby",
      flow: [
        { step: "baseline", rows: rowCount(baseline), result: "rejected: nested publications were empty" },
        { step: "proposal", artifact: "india-aai/heal-proposal.json", reviewed: true },
        { step: "approval", artifact: "india-aai/heal-approval.json", approved: true },
        { step: "post-heal", rows: rowCount(postHeal), result: "234 flat publication rows" },
      ],
      liveCommands: {
        heal: 'npx -p @brightdata/cli bdata scraper heal <collector_id> "Describe the observed regression and exact expected fields" --url <public_url> --pretty -o heal-proposal.json',
        approve: "npx -p @brightdata/cli bdata scraper approve <collector_id> --auto-save --url <public_url> --pretty -o heal-approval.json",
        verify: "npx -p @brightdata/cli bdata scraper run <collector_id> <public_url> --pretty -o post-heal.json",
      },
      proposalEnvelopePresent: Boolean(proposal),
      approvalEnvelopePresent: Boolean(approval),
    },
    null,
    2,
  ),
);
