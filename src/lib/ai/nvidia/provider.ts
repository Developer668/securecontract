import { z } from 'zod';
import { buildCopilotContext, type ApplicationContext, type VendorProfile } from '../context.js';
import { secureContractSystemPrompt } from '../system-prompt.js';
import type { Opportunity } from '../../../types.js';
export interface SecureContractCopilotResponse { answer:string; evidenceFields:string[]; opportunityIds:string[]; draft:boolean; }
export interface CopilotProvider { chat(request:{question:string;opportunity:Opportunity;relatedOpportunities?:Opportunity[];vendor?:VendorProfile;workspace?:ApplicationContext}):Promise<SecureContractCopilotResponse>; }
const responseSchema=z.object({answer:z.string().min(1),evidenceFields:z.array(z.string()),opportunityIds:z.array(z.string()).default([]),draft:z.boolean()});
export class NvidiaNimProvider implements CopilotProvider {
  constructor(private config:{apiKey:string;baseUrl:string;model:string}, private fetcher:typeof fetch=fetch) {}
  async chat(request:{question:string;opportunity:Opportunity;relatedOpportunities?:Opportunity[];vendor?:VendorProfile;workspace?:ApplicationContext}) {
    const context=buildCopilotContext(request.opportunity,request.vendor,request.workspace);
    const related=(request.relatedOpportunities??[]).map((item)=>({id:item.id,title:item.titleOriginal,buyer:item.buyerOriginal,status:item.status,country:item.countryName,deadline:item.submissionDueAt,sourceUrl:item.sourceUrl,detailUrl:item.detailUrl,description:item.descriptionEnglish??item.descriptionOriginal,evidence:item.evidence.slice(0,6).map(({fieldName,normalizedValue,sourceUrl})=>({fieldName,normalizedValue,sourceUrl}))}));
    const response=await this.fetcher(`${this.config.baseUrl}/chat/completions`,{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(25_000),body:JSON.stringify({model:this.config.model,temperature:0.1,max_tokens:700,response_format:{type:'json_object'},messages:[{role:'system',content:secureContractSystemPrompt},{role:'user',content:JSON.stringify({question:request.question,selectedContract:context,searchCandidates:related,instructions:'For a search question, recommend only candidates in searchCandidates and include their official detailUrl or sourceUrl. For a selected contract, use the selectedContract URL and evidence. Return JSON with answer, evidenceFields, opportunityIds, draft.'})}]})});
    if(!response.ok) throw new Error(`NVIDIA NIM request failed (${response.status})`);
    const body=await response.json() as {choices?:Array<{message?:{content?:string}}>}; const content=body.choices?.[0]?.message?.content;
    if(!content) throw new Error('NVIDIA NIM returned no content');
    const parsed=responseSchema.parse(JSON.parse(content.replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')));
    const evidenceFields=new Map(context.evidence.map((item)=>[item.fieldName.toLowerCase(),item.fieldName]));
    const groundedFields=[...new Set(parsed.evidenceFields.map((field)=>evidenceFields.get(field.trim().toLowerCase())).filter((field):field is string=>Boolean(field)))];
    const allowedIds=new Set([request.opportunity.id,...(request.relatedOpportunities??[]).map((item)=>item.id)]);
    return {...parsed,evidenceFields:groundedFields,opportunityIds:[...new Set(parsed.opportunityIds.filter((id)=>allowedIds.has(id)))]};
  }
}
