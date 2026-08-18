import { describe,expect,it } from 'vitest';
import { classifySeverity, diffOpportunity, normalizeProcedure, normalizeStatus, parseLocalDate, stableHash } from '../../src/lib/normalization';
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
  it('maps Chicago solicitation table rows',()=>{
    const source=liveSources.find(candidate=>candidate.slug==='us-chicago-solicitations')!;
    const html='<table><tbody><tr><td>CITY</td><td>RFP</td><td>CHI-1</td><td>Technology services</td><td>Open</td><td>08/17/2026</td><td>09/01/2026</td><td><a href="/vcsearch/solicitations/1">View</a></td></tr></tbody></table>';
    expect(publicScraperParsers.chicagoRows(html,source)[0]).toMatchObject({title:'Technology services',solicitation_id:'CHI-1',organization:'City of Chicago'});
  });
});
