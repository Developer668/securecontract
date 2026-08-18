import { describe,expect,it,vi } from 'vitest';
import { BrightDataClient } from '../../src/lib/bright-data/client';
import { NvidiaNimProvider } from '../../src/lib/ai/nvidia/provider';
import { opportunities } from '../../src/data/demo';
import { MemoryIngestionStore, ingestRows } from '../../src/lib/ingestion';
import { sources } from '../../src/data/demo';

describe('server integrations',()=>{
  it('triggers and retrieves Bright Data without exposing its token',async()=>{const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({collection_id:'j_demo'}),{status:200})).mockResolvedValueOnce(new Response(JSON.stringify([{title:'row'}]),{status:200}));const client=new BrightDataClient('secret',fetcher);const id=await client.trigger('c_123abc','https://example.gov');expect(id).toBe('j_demo');expect(await client.dataset(id)).toEqual([{title:'row'}]);expect(JSON.stringify(fetcher.mock.calls)).not.toContain('secret"}');});
  it('normalizes valid NIM citations and drops fields outside collected evidence',async()=>{const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({answer:'Verify the official deadline.',evidenceFields:['SubmissionDueAt','inventedRequirement'],draft:true})}}]}),{status:200}));const provider=new NvidiaNimProvider({apiKey:'secret',baseUrl:'https://nim.example/v1',model:'model'},fetcher);const result=await provider.chat({question:'What is due?',opportunity:opportunities[0]});expect(result.evidenceFields).toEqual(['submissionDueAt']);});
});

describe('ingestion boundary',()=>{
  it('archives a rejected run without overwriting last-known-good data',async()=>{
    const store=new MemoryIngestionStore();
    store.opportunities.set(opportunities[0].id,opportunities[0]);
    const source={...sources[0],adapterKey:'declarative',requiredFields:['title','detail_url']};
    const result=await ingestRows({source,collectionId:'j_failed',rows:[],store,baselineRowCount:12,observedAt:'2026-08-17T12:00:00Z'});
    expect(result.preservedLastKnownGood).toBe(true);
    expect(result.run.status).toBe('degraded');
    expect(store.opportunities.get(opportunities[0].id)).toEqual(opportunities[0]);
  });
  it('archives raw rows before publishing validated canonical data',async()=>{
    const store=new MemoryIngestionStore();
    const source={...sources[0],id:'source-ingest',adapterKey:'declarative',requiredFields:['title','detail_url']};
    const raw={title:'Network maintenance',detail_url:'https://example.gov/tenders/42',external_id:'42',status_raw:'Open'};
    const result=await ingestRows({source,collectionId:'j_success',rows:[raw],store,observedAt:'2026-08-17T12:00:00Z'});
    expect(store.rawRecords[0]?.raw).toEqual(raw);
    expect(result.published).toHaveLength(1);
    expect(store.opportunities.size).toBe(1);
  });
  it('validates auxiliary collector rows without publishing them to the opportunity feed',async()=>{
    const store=new MemoryIngestionStore();
    const source={...sources[0],id:'source-auxiliary',adapterKey:'declarative',requiredFields:['title','detail_url']};
    const raw={title:'Regulatory publication',detail_url:'https://example.gov/publications/42',external_id:'42',status_raw:'Published'};
    const result=await ingestRows({source,collectionId:'j_auxiliary',rows:[raw],store,publish:false,observedAt:'2026-08-17T12:00:00Z'});
    expect(store.rawRecords).toHaveLength(1);
    expect(result.run.status).toBe('healthy');
    expect(result.run.validRowCount).toBe(1);
    expect(result.published).toHaveLength(0);
    expect(store.opportunities.size).toBe(0);
  });
  it('creates a new version only for material changed content',async()=>{
    const store=new MemoryIngestionStore();
    const source={...sources[0],id:'source-version',adapterKey:'declarative',requiredFields:['title','detail_url']};
    const base={title:'Network maintenance',detail_url:'https://example.gov/tenders/42',external_id:'42',status_raw:'Open'};
    await ingestRows({source,collectionId:'j_v1',rows:[base],store,observedAt:'2026-08-17T12:00:00Z'});
    await ingestRows({source,collectionId:'j_same',rows:[base],store,observedAt:'2026-08-18T12:00:00Z'});
    expect(store.versions.get('source-version:42')).toHaveLength(1);
    await ingestRows({source,collectionId:'j_v2',rows:[{...base,status_raw:'Cancelled'}],store,observedAt:'2026-08-19T12:00:00Z'});
    expect(store.versions.get('source-version:42')).toHaveLength(2);
    expect(store.changes.some((change)=>change.field==='status'&&change.severity==='critical')).toBe(true);
  });
});
