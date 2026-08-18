import { assertPublicHttpUrl } from '../security.js';
const API_BASE = 'https://api.brightdata.com';
export class BrightDataError extends Error { constructor(message:string, public status?:number) { super(message); } }
export class BrightDataClient {
  constructor(private token:string, private fetcher:typeof fetch = fetch) {}
  private headers() { return { Authorization:`Bearer ${this.token}`, 'Content-Type':'application/json' }; }
  async trigger(collectorId:string, inputUrl:string):Promise<string> {
    if (!/^c_[a-zA-Z0-9]+$/.test(collectorId)) throw new BrightDataError('Invalid Collector ID');
    assertPublicHttpUrl(inputUrl);
    const response = await this.fetcher(`${API_BASE}/dca/trigger?collector=${encodeURIComponent(collectorId)}&queue_next=1`, { method:'POST', headers:this.headers(), body:JSON.stringify([{url:inputUrl}]) });
    if (!response.ok) throw new BrightDataError(`Bright Data trigger failed (${response.status})`,response.status);
    const body = await response.json() as { collection_id?:string };
    if (!body.collection_id) throw new BrightDataError('Trigger response did not contain collection_id');
    return body.collection_id;
  }
  async dataset(snapshotId:string):Promise<unknown[] | {status:string}> {
    const response = await this.fetcher(`${API_BASE}/dca/dataset?id=${encodeURIComponent(snapshotId)}`, { headers:this.headers() });
    if (!response.ok) throw new BrightDataError(`Bright Data dataset failed (${response.status})`,response.status);
    return response.json() as Promise<unknown[] | {status:string}>;
  }
  async poll(snapshotId:string, options:{attempts?:number;baseDelayMs?:number}={}):Promise<unknown[]> {
    const attempts = options.attempts ?? 8; const baseDelayMs = options.baseDelayMs ?? 1000;
    for (let attempt=0; attempt<attempts; attempt++) {
      const body = await this.dataset(snapshotId);
      if (Array.isArray(body)) return body;
      await new Promise(resolve => setTimeout(resolve,Math.min(15000,baseDelayMs*2**attempt)));
    }
    throw new BrightDataError('Collection is still pending; poll later instead of holding the request open');
  }
  async searchFundingSite(sourceUrl:string):Promise<unknown[]> {
    const source = assertPublicHttpUrl(sourceUrl);
    const year=new Date().getUTCFullYear();
    const queries=[
      `site:${source.hostname} ("funding opportunity" OR "request for proposals" OR "apply for a grant") biomedical ${year} ${year+1}`,
      `site:${source.hostname} ("research award" OR fellowship OR "young investigator" OR "seed grant") (deadline OR applications)`,
      `site:${source.hostname} (pilot OR equipment OR compute OR accelerator OR challenge) (grant OR funding OR award) research`,
    ];
    const pages=await Promise.all(queries.map(async(query)=>{
      const searchUrl=`https://www.google.com/search?q=${encodeURIComponent(query)}&brd_json=1&num=20`;
      const response=await this.fetcher(`${API_BASE}/request`,{method:'POST',headers:this.headers(),body:JSON.stringify({zone:'cli_unlocker',url:searchUrl,format:'json',country:'us'})});
      if(!response.ok)throw new BrightDataError(`Bright Data search failed (${response.status})`,response.status);
      const envelope=await response.json() as {body?:string|{organic?:Array<{title?:string;link?:string;description?:string}>};organic?:Array<{title?:string;link?:string;description?:string}>};
      return typeof envelope.body==='string'?JSON.parse(envelope.body) as {organic?:Array<{title?:string;link?:string;description?:string}>}:envelope.body??envelope;
    }));
    const sourceHost = source.hostname.replace(/^www\./,'');
    const unique=new Map<string,{title:string;detail_url:string;summary:string;external_id:string}>();
    pages.flatMap((page)=>page.organic??[]).forEach((result,index)=>{
      if (!result.title || !result.link) return [];
      try {
        const resultHost = assertPublicHttpUrl(result.link).hostname.replace(/^www\./,'');
        if (resultHost !== sourceHost && !resultHost.endsWith(`.${sourceHost}`)) return [];
      } catch { return; }
      const combined = `${result.title} ${result.description ?? ''}`;
      if (!/(funding opportunit|request for proposal|apply|application|deadline|grant|award|fellowship)/i.test(combined)) return;
      if (/(^(news|awardees|how to apply|applying\/eligibility|the scientific review process|phase i application instructions)$|^year:|^national institute|\bprofile\b|\bbiograph|\bbio\b|teaming|press release|newsroom|standard due dates|policy|annual report)/i.test(result.title.trim())) return;
      const url=new URL(result.link);url.hash='';for(const key of [...url.searchParams.keys()])if(/^utm_|^(?:ref|source|campaign)$/i.test(key))url.searchParams.delete(key);
      unique.set(url.toString().toLowerCase(),{title:result.title,detail_url:url.toString(),summary:result.description??'No source snippet was returned.',external_id:`serp-${index}-${url}`});
    });
    return [...unique.values()];
  }
}
