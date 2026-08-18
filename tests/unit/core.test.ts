import { describe,expect,it } from 'vitest';
import { classifySeverity, closeExpiredOpportunity, diffOpportunity, normalizeProcedure, normalizeStatus, parseLocalDate, stableHash, statusAtDeadline } from '../../src/lib/normalization';
import { validateRun } from '../../src/lib/validation';
import { buildCopilotContext } from '../../src/lib/ai/context';
import { adapterFor } from '../../src/lib/sources';
import { assertPublicHttpUrl } from '../../src/lib/security';
import { opportunities, sources } from '../../src/data/demo';
import { normalizeFundingRows } from '../../src/lib/funding-ingestion';
import { fundingSources } from '../../src/data/funding-demo';

describe('normalization',()=>{
  it('normalizes conservatively',()=>{expect(normalizeStatus('Open Tender')).toBe('open');expect(normalizeStatus('mystery')).toBe('unknown');expect(normalizeProcedure('RFP')).toBe('request_for_proposal');});
  it('hashes without volatile collection metadata',()=>{const first=stableHash({...opportunities[0],collectedAt:'a'});const second=stableHash({...opportunities[0],collectedAt:'b'});expect(first).toBe(second);});
  it('makes deadlines critical',()=>expect(classifySeverity('submissionDueAt','a','b')).toBe('critical'));
  it('creates a material diff',()=>expect(diffOpportunity(opportunities[0],{...opportunities[0],submissionDueAt:'2026-09-01T00:00:00Z'}).some(change=>change.severity==='critical')).toBe(true));
  it('parses portal dates in their configured timezone',()=>{expect(parseLocalDate('26-Aug-2026 17:00','Asia/Kolkata')).toBe('2026-08-26T11:30:00.000Z');expect(parseLocalDate('18 Aug 2026 | 5pm AEST','Australia/Sydney')).toBe('2026-08-18T07:00:00.000Z');expect(parseLocalDate('7/17/2026','America/Los_Angeles')).toBe('2026-07-17T07:00:00.000Z');expect(parseLocalDate('not a date','Asia/Kolkata')).toBeNull();});
  it('closes expired opportunities from their submission deadline',()=>{expect(statusAtDeadline('open','2026-08-16T00:00:00.000Z','2026-08-17T00:00:00.000Z')).toBe('closed');expect(statusAtDeadline('open','2026-08-18T00:00:00.000Z','2026-08-17T00:00:00.000Z')).toBe('open');const closed=closeExpiredOpportunity({...opportunities[0],status:'open',submissionDueAt:'2026-08-16T00:00:00.000Z'},'2026-08-17T00:00:00.000Z');expect(closed.status).toBe('closed');expect(closed.changes).toEqual(expect.arrayContaining([expect.objectContaining({field:'status',newValue:'closed'})]));});
});
describe('run protection',()=>{
  it('rejects zero rows and preserves last-known-good',()=>expect(validateRun({rowCount:0,baselineRowCount:100,requiredFieldCompleteness:0,dateParseRate:0,duplicateRate:0,schemaStability:0,freshness:1,accessWallDetected:false})).toMatchObject({accepted:false,health:'degraded'}));
  it('accepts a stable complete run',()=>expect(validateRun({rowCount:98,baselineRowCount:100,requiredFieldCompleteness:.99,dateParseRate:.98,duplicateRate:.01,schemaStability:1,freshness:1,accessWallDetected:false}).accepted).toBe(true));
});
describe('open-ended sources',()=>{
  it('normalizes an arbitrary Brazil source without country branches',()=>{const brazil={...sources[0],id:'src-br',slug:'brazil-demo',countryCode:'BR',countryName:'Brazil',timezone:'America/Sao_Paulo',currency:'BRL',adapterKey:'declarative'};const result=adapterFor(brazil.adapterKey).normalize({title:'Public cloud services',detail_url:'https://compras.example.gov.br/notices/1',external_id:'BR-1',closing_date_iso:'2026-09-01T12:00:00-03:00'},{source:brazil,collectedAt:'2026-08-17T00:00:00Z'});expect(result.opportunity.countryCode).toBe('BR');expect(result.opportunity.currency).toBe('BRL');});
});
describe('copilot grounding',()=>it('contains evidence and explicit missing-data rules',()=>{const context=buildCopilotContext(opportunities[0]);expect(context.evidence.length).toBeGreaterThan(0);expect(context.rules.join(' ')).toContain('absent');}));
describe('source URL security',()=>it('blocks private targets',()=>{expect(()=>assertPublicHttpUrl('http://127.0.0.1/admin')).toThrow(/Private/);expect(assertPublicHttpUrl('https://example.gov/tenders').hostname).toBe('example.gov');}));
describe('Bright Data funding normalization',()=>{
  it('publishes only rows with a title and official detail URL',()=>{
    const source=fundingSources[0];
    const rows=normalizeFundingRows(source,[
      {title:'Biomedical innovation award',detail_url:'https://example.org/funding/1',deadline:'2027-02-01',eligibility:'US research institutes may apply',amount:'$750,000',external_id:'F-1'},
      {title:'Incomplete record without a source URL'},
    ],'2026-08-18T16:30:00.000Z');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({title:'Biomedical innovation award',amountMin:750000,provenance:'bright_data_live',geography:'US'});
    expect(rows[0]?.match.eligibility).toBe('insufficient_evidence');
    expect(rows[0]?.evidence.map((item)=>item.field)).toEqual(['title','deadline','eligibility','amount','summary']);
  });
  it('closes a collected record whose deadline has passed',()=>{
    const rows=normalizeFundingRows(fundingSources[0],[{title:'Expired award',detail_url:'https://example.org/funding/expired',deadline:'2020-01-01'}]);
    expect(rows[0]?.status).toBe('closed');
  });
});
