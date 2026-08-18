import { z } from 'zod';
import type { FundingOpportunity, LabProfile } from '../../types.js';

const fundingResponseSchema = z.object({
  answer: z.string().min(1),
  evidenceIds: z.array(z.string()),
  opportunityIds: z.array(z.string()),
  followUpQuestions: z.array(z.string()).max(3),
});

export type FundingChatResponse = z.infer<typeof fundingResponseSchema> & {
  draft: true;
};

const systemPrompt = `You are FundingSecured, an evidence-grounded funding navigator for early-stage US biomedical labs and research startups.
Use only the supplied lab profile, opportunity records, deterministic match results, and exact evidence passages.
Eligibility states are fixed safety boundaries. Never upgrade insufficient_evidence or likely_confirmation_required to verified_eligible.
Never invent an amount, deadline, eligibility condition, partner, institution rule, publication, capability, or application fact.
When the evidence is absent, explicitly say what is missing and which official source must be checked.
For every consequential claim, cite only an exact evidence id present in the context. Return only JSON with answer, evidenceIds, opportunityIds, and followUpQuestions.`;

export class FundingNimProvider {
  constructor(
    private config: { apiKey: string; baseUrl: string; model: string },
    private fetcher: typeof fetch = fetch,
  ) {}

  async chat(input: {
    question: string;
    profile: LabProfile;
    opportunities: FundingOpportunity[];
  }): Promise<FundingChatResponse> {
    const context = {
      profile: input.profile,
      opportunities: input.opportunities.map((item) => ({
        id: item.id,
        title: item.title,
        funder: item.funder,
        category: item.category,
        researchAreas: item.researchAreas,
        amountText: item.amountText,
        deadline: item.deadline,
        deadlineText: item.deadlineText,
        status: item.status,
        requiredPartners: item.requiredPartners,
        match: item.match,
        evidence: item.evidence,
        sourceUrl: item.sourceUrl,
      })),
    };
    const response = await this.fetcher(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.05,
        max_tokens: 900,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify({ question: input.question, context }) },
        ],
      }),
    });
    if (!response.ok) throw new Error(`NVIDIA NIM request failed (${response.status})`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('NVIDIA NIM returned no content');
    const parsed = fundingResponseSchema.parse(
      JSON.parse(content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')),
    );
    const allowedEvidence = new Set(input.opportunities.flatMap((item) => item.evidence.map((entry) => entry.id)));
    const allowedOpportunities = new Set(input.opportunities.map((item) => item.id));
    return {
      ...parsed,
      evidenceIds: [...new Set(parsed.evidenceIds.filter((id) => allowedEvidence.has(id)))],
      opportunityIds: [...new Set(parsed.opportunityIds.filter((id) => allowedOpportunities.has(id)))],
      draft: true,
    };
  }
}
