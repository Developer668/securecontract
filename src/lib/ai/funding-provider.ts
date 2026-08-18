import { z } from 'zod';
import type { FundingOpportunity, LabProfile } from '../../types.js';

const fundingResponseSchema = z.object({
  answer: z.string().min(1),
  evidenceIds: z.array(z.string()),
  opportunityIds: z.array(z.string()),
  followUpQuestions: z.array(z.string()).max(3),
});
const scoreResponseSchema = z.object({scores:z.array(z.object({
  opportunityId:z.string(),score:z.number().min(0).max(100),
  explanation:z.string().min(1),relevantCapabilities:z.array(z.string()).optional().default([]),
  missingInformation:z.array(z.string()).optional().default([]),eligibility:z.enum(['likely_confirmation_required','insufficient_evidence','not_eligible']),
}))});

export type FundingChatResponse = z.infer<typeof fundingResponseSchema> & {
  draft: true;
};

const systemPrompt = `You are FundingSecured, an evidence-grounded funding navigator for early-stage US biomedical labs and research startups.
Use only the supplied lab profile, complete retrieved opportunity JSON, portfolio catalog, match results, and evidence passages.
Eligibility states are fixed safety boundaries. Never upgrade insufficient_evidence or likely_confirmation_required to verified_eligible.
Never invent an amount, deadline, eligibility condition, partner, institution rule, publication, capability, or application fact.
When the evidence is absent, explicitly say what is missing and which official source must be checked.
Answer conversationally and directly. Name the grants you recommend, explain why each could fit, state important uncertainty, and compare tradeoffs when useful.
For every consequential claim, cite only an evidence id present in the context. Return only JSON with answer, evidenceIds, opportunityIds, and followUpQuestions.`;

const parseJson = (content:string) => {
  const cleaned=content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  try{return JSON.parse(cleaned) as unknown;}catch{
    const start=cleaned.indexOf('{');let depth=0;let quoted=false;let escaped=false;
    for(let index=start;index<cleaned.length;index++) {const char=cleaned[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}if(char==='"'){quoted=true;continue;}if(char==='{')depth++;if(char==='}'&&--depth===0)return JSON.parse(cleaned.slice(start,index+1)) as unknown;}
    throw new Error('NVIDIA NIM returned malformed JSON');
  }
};

export class FundingNimProvider {
  constructor(
    private config: { apiKey: string; baseUrl: string; model: string },
    private fetcher: typeof fetch = fetch,
  ) {}

  async chat(input: {
    question: string;
    profile: LabProfile;
    opportunities: FundingOpportunity[];
    catalog?: Array<Pick<FundingOpportunity,'id'|'title'|'funder'|'summary'|'deadlineText'|'amountText'|'status'|'detailUrl'>>;
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
        detailUrl:item.detailUrl,
        institutionTypes:item.institutionTypes,
        careerStages:item.careerStages,
        commercializationStages:item.commercializationStages,
        tasks:item.tasks,
        raw:item.raw ?? {},
      })),
      portfolioCatalog:input.catalog ?? [],
    };
    const request = () => this.fetcher(`${this.config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(25_000),
      body: JSON.stringify({
        model: this.config.model,
        temperature: 0.05,
        max_tokens: 1400,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: JSON.stringify({ question: input.question, context }) },
        ],
      }),
    });
    let response=await request();for(let retry=0;response.status===429&&retry<2;retry++){await new Promise((resolve)=>setTimeout(resolve,2500*(retry+1)));response=await request();}
    if (!response.ok) throw new Error(`NVIDIA NIM request failed (${response.status})`);
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) throw new Error('NVIDIA NIM returned no content');
    const parsed = fundingResponseSchema.parse(
      parseJson(content),
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

  async score(input:{profile:LabProfile;opportunities:FundingOpportunity[]}):Promise<Map<string,z.infer<typeof scoreResponseSchema>['scores'][number]>> {
    const records=input.opportunities.map((item)=>({
      opportunityId:item.id,title:item.title,funder:item.funder,summary:item.summary,amount:item.amountText,
      deadline:item.deadlineText,status:item.status,researchAreas:item.researchAreas,careerStages:item.careerStages,
      institutionTypes:item.institutionTypes,requiredPartners:item.requiredPartners,commercializationStages:item.commercializationStages,
      evidence:item.evidence,raw:item.raw ?? {},
    }));
    const request=()=>this.fetcher(`${this.config.baseUrl}/chat/completions`,{
      method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(90_000),
      body:JSON.stringify({model:this.config.model,temperature:0.05,max_tokens:6500,messages:[
        {role:'system',content:`Score scientific funding fit from 0-100 using only the supplied lab profile and collected JSON. Compare research topic, methods, equipment, career stage, institution type, collaboration needs, commercialization stage, amount, and explicit eligibility. Do not reward missing data. Never output verified eligibility. If applicant requirements are absent, eligibility must be insufficient_evidence. If explicit requirements exist but need human confirmation, use likely_confirmation_required. Keep each explanation under 24 words. Return every record exactly once and only JSON: {"scores":[{"opportunityId":"...","score":0,"explanation":"...","eligibility":"insufficient_evidence"}]}.`},
        {role:'user',content:JSON.stringify({profile:input.profile,records})},
      ]}),
    });
    let response=await request();
    for(let retry=0;response.status===429&&retry<4;retry++){await new Promise((resolve)=>setTimeout(resolve,3000*(retry+1)));response=await request();}
    if(!response.ok)throw new Error(`NVIDIA NIM scoring failed (${response.status})`);
    const body=await response.json() as {choices?:Array<{message?:{content?:string}}>};
    const content=body.choices?.[0]?.message?.content;if(!content)throw new Error('NVIDIA NIM returned no scoring content');
    const parsed=scoreResponseSchema.parse(parseJson(content));
    return new Map(parsed.scores.map((score)=>[score.opportunityId,score]));
  }
}
