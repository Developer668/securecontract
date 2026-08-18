import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { FundingEvent, FundingOpportunity, FundingSource, LabProfile } from '../types.js';

export interface FundingState {
  version:2;
  savedAt:string;
  profile:LabProfile|null;
  opportunities:FundingOpportunity[];
  sources:FundingSource[];
  events:FundingEvent[];
}

export const fundingStatePath=process.env.FUNDING_STATE_PATH ?? 'runtime/fundingsecured-state.json';

export function loadFundingState():FundingState|null {
  if(!existsSync(fundingStatePath))return null;
  try {
    const value=JSON.parse(readFileSync(fundingStatePath,'utf8')) as FundingState;
    return value.version===2&&Array.isArray(value.opportunities)&&Array.isArray(value.sources)?value:null;
  } catch { return null; }
}

export function saveFundingState(state:Omit<FundingState,'version'|'savedAt'>) {
  mkdirSync(dirname(fundingStatePath),{recursive:true});
  const temporary=`${fundingStatePath}.tmp`;
  writeFileSync(temporary,JSON.stringify({version:2,savedAt:new Date().toISOString(),...state},null,2));
  renameSync(temporary,fundingStatePath);
}
