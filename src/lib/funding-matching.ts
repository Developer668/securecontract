import type { FundingMatch, FundingOpportunity, LabProfile } from '../types.js';

const tokens = (values: string[]) => new Set(
  values.join(' ').toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 3),
);

export function matchFundingOpportunity(item: FundingOpportunity, profile: LabProfile): FundingMatch {
  if (item.status === 'closed') {
    return {
      eligibility: 'not_eligible',
      score: 0,
      explanation: 'The collected deadline has passed, so this opportunity is closed.',
      relevantCapabilities: [],
      missingInformation: [],
      requirements: [{ id:`${item.id}-deadline`, label:'Open application window', state:'unmet', evidenceId:item.evidence.find((entry)=>entry.field==='deadline')?.id ?? null }],
    };
  }
  const labValues = [...profile.researchAreas, ...profile.methods, ...profile.equipment, ...profile.previousWork, profile.commercializationStage];
  const opportunityValues = [item.title, item.summary, ...item.researchAreas, ...item.commercializationStages];
  const labTokens = tokens(labValues);
  const opportunityTokens = tokens(opportunityValues);
  const overlap = [...labTokens].filter((token) => opportunityTokens.has(token));
  const relevantCapabilities = labValues.filter((value) => {
    const valueTokens = tokens([value]);
    return [...valueTokens].some((token) => opportunityTokens.has(token));
  }).slice(0, 5);
  let score = Math.min(86, 34 + overlap.length * 7 + relevantCapabilities.length * 4);
  if (item.amountMax && profile.desiredFundingMin && item.amountMax >= profile.desiredFundingMin) score += 5;
  if (item.amountMin && profile.desiredFundingMax && item.amountMin <= profile.desiredFundingMax) score += 5;
  const eligibilityEvidence = item.evidence.find((entry) => entry.field === 'eligibility');
  const missingInformation = [
    ...(!eligibilityEvidence ? ['Exact applicant eligibility passage'] : []),
    ...(!item.deadline && item.status !== 'rolling' ? ['Application deadline'] : []),
    ...(!item.amountText || item.amountText === 'Not stated' ? ['Award amount'] : []),
    ...(!profile.previousWork.length ? ['Previous projects or publications'] : []),
  ];
  score = Math.max(1, Math.min(96, score));
  return {
    eligibility: eligibilityEvidence ? 'likely_confirmation_required' : 'insufficient_evidence',
    score,
    explanation: eligibilityEvidence
      ? `The collected topic and capability signals support a ${score}% match, but the official applicant conditions still require confirmation.`
      : `The scientific signals support a ${score}% match, but no complete applicant-eligibility passage was collected.`,
    relevantCapabilities,
    missingInformation,
    requirements: [{
      id:`${item.id}-eligibility`,
      label:'Confirm every applicant and institutional condition',
      state:'unknown',
      evidenceId:eligibilityEvidence?.id ?? null,
    }],
  };
}
