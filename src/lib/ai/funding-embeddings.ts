import type { FundingOpportunity, LabProfile } from '../../types.js';

const cosine=(a:number[],b:number[])=>{let dot=0,left=0,right=0;for(let index=0;index<a.length;index++){dot+=a[index]*b[index];left+=a[index]**2;right+=b[index]**2}return dot/(Math.sqrt(left)*Math.sqrt(right)||1)};
const compact=(value:unknown,limit=7000)=>JSON.stringify(value).slice(0,limit);

export class FundingEmbeddingProvider {
  constructor(private config:{apiKey:string;baseUrl:string;model:string},private fetcher:typeof fetch=fetch){}
  private async embed(input:string[],inputType:'query'|'passage'){
    const request=()=>this.fetcher(`${this.config.baseUrl}/embeddings`,{method:'POST',headers:{Authorization:`Bearer ${this.config.apiKey}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(60_000),body:JSON.stringify({model:this.config.model,input,input_type:inputType,encoding_format:'float'})});
    let response=await request();for(let retry=0;response.status===429&&retry<4;retry++){await new Promise((resolve)=>setTimeout(resolve,1500*(retry+1)));response=await request();}
    if(!response.ok)throw new Error(`NVIDIA embedding request failed (${response.status})`);
    const body=await response.json() as {data?:Array<{index:number;embedding:number[]}>};
    if(!body.data||body.data.length!==input.length)throw new Error('NVIDIA embedding response was incomplete');
    return [...body.data].sort((a,b)=>a.index-b.index).map((entry)=>entry.embedding);
  }
  async score(profile:LabProfile,opportunities:FundingOpportunity[]){
    const profileText=compact({institution:profile.institution,researchAreas:profile.researchAreas,methods:profile.methods,careerStages:profile.careerStages,equipment:profile.equipment,previousWork:profile.previousWork,fundingRange:[profile.desiredFundingMin,profile.desiredFundingMax],collaborationPreferences:profile.collaborationPreferences,commercializationStage:profile.commercializationStage});
    const [profileVector]=await this.embed([profileText],'query');const values=new Map<string,{score:number;similarity:number}>();
    for(let offset=0;offset<opportunities.length;offset+=64){
      const batch=opportunities.slice(offset,offset+64);const vectors=await this.embed(batch.map((item)=>compact({title:item.title,funder:item.funder,summary:item.summary,researchAreas:item.researchAreas,amount:item.amountText,deadline:item.deadlineText,careerStages:item.careerStages,institutionTypes:item.institutionTypes,requiredPartners:item.requiredPartners,commercializationStages:item.commercializationStages,evidence:item.evidence,raw:item.raw??{}})),'passage');
      batch.forEach((item,index)=>{const similarity=cosine(profileVector,vectors[index]);const score=Math.round(Math.max(1,Math.min(96,(similarity-.18)/.55*100)));values.set(item.id,{score,similarity})});
    }
    return values;
  }
}
