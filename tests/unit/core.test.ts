import { describe,expect,it } from 'vitest';
import { classifySeverity, closeExpiredOpportunity, diffOpportunity, normalizeProcedure, normalizeStatus, parseLocalDate, stableHash, statusAtDeadline } from '../../src/lib/normalization';
import { validateRun } from '../../src/lib/validation';
import { buildCopilotContext } from '../../src/lib/ai/context';
import { adapterFor } from '../../src/lib/sources';
import { assertPublicHttpUrl } from '../../src/lib/security';
import { opportunities, sources } from '../../src/data/demo';
import { liveSources } from '../../src/data/live-sources';
import { publicScraperParsers } from '../../src/lib/public-scrapers';

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
describe('public source parsers',()=>{
  it('maps CanadaBuys open-tender CSV without contact fields',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='canada-canadabuys')!;
    const csv='title-titre-eng,solicitationNumber-numeroSollicitation,referenceNumber-numeroReference,contractingEntityName-nomEntitContractante-eng,tenderStatus-appelOffresStatut-eng,publicationDate-datePublication,tenderClosingDate-appelOffresDateCloture,noticeURL-URLavis-eng\n"Road services","CA-1","cb-1","Public Works","Open","2026/08/17","2026/09/01",""';
    expect(publicScraperParsers.canadaBuysRows(csv,source)[0]).toMatchObject({title:'Road services',solicitation_id:'CA-1',organization:'Public Works',detail_url:'https://canadabuys.canada.ca/en/tender-opportunities/tender-notice/cb-1'});
  });
  it('does not return expired public-source rows',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='canada-canadabuys')!;
    const csv='title-titre-eng,solicitationNumber-numeroSollicitation,referenceNumber-numeroReference,contractingEntityName-nomEntitContractante-eng,tenderStatus-appelOffresStatut-eng,publicationDate-datePublication,tenderClosingDate-appelOffresDateCloture,noticeURL-URLavis-eng\n"Expired road services","CA-OLD","cb-old","Public Works","Open","2020/01/01","2020/02/01",""';
    expect(publicScraperParsers.canadaBuysRows(csv,source)).toHaveLength(0);
  });
  it('maps Chicago solicitation table rows',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='us-chicago-solicitations')!;
    const html='<table><tbody><tr><td>CITY</td><td>RFP</td><td>CHI-1</td><td>Technology services</td><td>Open</td><td>08/17/2026</td><td>09/01/2026</td><td><a href="/vcsearch/solicitations/1">View</a></td></tr></tbody></table>';
    expect(publicScraperParsers.chicagoRows(html,source)[0]).toMatchObject({title:'Technology services',solicitation_id:'CHI-1',organization:'City of Chicago'});
  });
  it('maps official US open-data API rows without contact data',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='us-nyc-current-bids')!;
    const input=JSON.stringify([{request_id:'20260818001',short_title:'Transit engineering services',agency_name:'Transportation',type_of_notice_description:'Solicitation',selection_method_description:'Competitive Sealed Proposals',start_date:'2026-08-18T00:00:00.000',due_date:'2026-09-18T12:00:00.000',contact_name:'Private field not collected'}]);
    const row=publicScraperParsers.nycRows(input,source)[0];
    expect(row).toMatchObject({title:'Transit engineering services',solicitation_id:'20260818001',organization:'Transportation',status_raw:'Open'});
    expect(row).not.toHaveProperty('contact_name');
  });
  it('maps multilingual TED notices and keeps the latest open lot deadline',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='eu-ted-open-notices')!;
    const rows=publicScraperParsers.tedRows([{'publication-number':'123-2026','notice-title':{eng:'Rail engineering services'},'buyer-name':{eng:['European Rail Agency']},'form-type':'competition','publication-date':'2026-08-18Z','deadline-receipt-tender-date-lot':['2026-08-01+02:00','2027-01-10+01:00']}],source);
    expect(rows[0]).toMatchObject({title:'Rail engineering services',solicitation_id:'123-2026',organization:'European Rail Agency',closing_date_raw:'2027-01-10T23:59:59+01:00'});
  });
});
