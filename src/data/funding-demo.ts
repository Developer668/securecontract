import type { FundingEvent, FundingOpportunity, FundingSource } from '../types.js';

type SourceSeed = Pick<FundingSource, 'id'|'name'|'organization'|'category'|'sourceUrl'> & { collectorId?:string };

const seeds: SourceSeed[] = [
  {id:'src-nih',name:'NIH Active Opportunities',organization:'National Institutes of Health',category:'federal',sourceUrl:'https://grants.nih.gov/funding/explore-nih-opportunities?type=active'},
  {id:'src-nsf',name:'NSF Funding Opportunities',organization:'U.S. National Science Foundation',category:'federal',sourceUrl:'https://www.nsf.gov/funding/opportunities'},
  {id:'src-arpa-h',name:'ARPA-H Open Funding',organization:'Advanced Research Projects Agency for Health',category:'federal',sourceUrl:'https://arpa-h.gov/explore-funding/open-funding-opportunities'},
  {id:'src-pcori',name:'PCORI Funding Opportunities',organization:'Patient-Centered Outcomes Research Institute',category:'foundation',sourceUrl:'https://www.pcori.org/funding-opportunities'},
  {id:'src-czi',name:'CZI Science RFAs',organization:'Chan Zuckerberg Initiative',category:'foundation',sourceUrl:'https://chanzuckerberg.com/rfa/'},
  {id:'src-bwf',name:'BWF Funding Opportunities',organization:'Burroughs Wellcome Fund',category:'foundation',sourceUrl:'https://www.bwfund.org/funding-opportunities/'},
  {id:'src-simons',name:'Simons Foundation Funding',organization:'Simons Foundation',category:'foundation',sourceUrl:'https://www.simonsfoundation.org/funding-opportunities/'},
  {id:'src-acs',name:'American Cancer Society Research Grants',organization:'American Cancer Society',category:'foundation',sourceUrl:'https://www.cancer.org/research/we-fund-cancer-research/apply-research-grant.html'},
  {id:'src-alz',name:"Alzheimer's Association Research Grants",organization:"Alzheimer's Association",category:'foundation',sourceUrl:'https://www.alz.org/research/for_researchers/grants_funding'},
  {id:'src-mjff',name:'MJFF Funding Opportunities',organization:'The Michael J. Fox Foundation',category:'foundation',sourceUrl:'https://www.michaeljfox.org/funding-opportunities'},
  {id:'src-breakthrough-t1d',name:'Breakthrough T1D Research Funding',organization:'Breakthrough T1D',category:'foundation',sourceUrl:'https://www.breakthrought1d.org/for-researchers/research-funding-opportunities/'},
  {id:'src-damon-runyon',name:'Damon Runyon Awards',organization:'Damon Runyon Cancer Research Foundation',category:'foundation',sourceUrl:'https://www.damonrunyon.org/for-scientists/application-guidelines'},
  {id:'src-brightfocus',name:'BrightFocus Research Grants',organization:'BrightFocus Foundation',category:'foundation',sourceUrl:'https://www.brightfocus.org/research/apply-for-a-research-grant/'},
  {id:'src-mda',name:'MDA Research Grants',organization:'Muscular Dystrophy Association',category:'foundation',sourceUrl:'https://www.mda.org/science/funding-opportunities'},
  {id:'src-ffb',name:'Foundation Fighting Blindness Awards',organization:'Foundation Fighting Blindness',category:'foundation',sourceUrl:'https://www.fightingblindness.org/research-grants'},
  {id:'src-nord',name:'NORD Research Grants',organization:'National Organization for Rare Disorders',category:'foundation',sourceUrl:'https://rarediseases.org/research-grants/'},
  {id:'src-curealz',name:"Cure Alzheimer's Fund Research",organization:"Cure Alzheimer's Fund",category:'foundation',sourceUrl:'https://curealz.org/researchers/requests-for-proposals/'},
  {id:'src-lls',name:'LLS Research Programs',organization:'Leukemia & Lymphoma Society',category:'foundation',sourceUrl:'https://www.lls.org/research/research-grants'},
  {id:'src-komen',name:'Komen Research Grants',organization:'Susan G. Komen',category:'foundation',sourceUrl:'https://www.komen.org/breast-cancer-research/research-grants/'},
  {id:'src-aha',name:'AHA Research Programs',organization:'American Heart Association',category:'scientific_society',sourceUrl:'https://professional.heart.org/en/research-programs/application-information'},
  {id:'src-nkf',name:'NKF Research Grants',organization:'National Kidney Foundation',category:'foundation',sourceUrl:'https://www.kidney.org/professionals/research'},
  {id:'src-crohns',name:"Crohn's & Colitis Foundation Grants",organization:"Crohn's & Colitis Foundation",category:'foundation',sourceUrl:'https://www.crohnscolitisfoundation.org/researchers/grants-fellowships'},
  {id:'src-epilepsy',name:'Epilepsy Research Funding',organization:'Epilepsy Foundation',category:'foundation',sourceUrl:'https://www.epilepsy.com/advocacy/priorities/research/funding-opportunities'},
  {id:'src-grand-challenges',name:'Grand Challenges Funding',organization:'Gates Foundation',category:'foundation',sourceUrl:'https://gcgh.grandchallenges.org/challenges'},
];

export const fundingSources: FundingSource[] = seeds.map((source,index)=>({
  ...source,
  inputUrl:source.sourceUrl,
  collectorId:source.collectorId??null,
  status:'draft',
  requiredFields:['title','detail_url','deadline','eligibility','amount'],
  lastRunAt:null,
  lastRunStatus:null,
  recordCount:0,
  schedule:`Daily · ${String(6+Math.floor(index/3)).padStart(2,'0')}:${String((index%3)*20).padStart(2,'0')} PT`,
  collectionMethod:'bright_data',
}));

// Discovery starts empty. Only accepted Bright Data datasets can add opportunities.
export const fundingOpportunities: FundingOpportunity[] = [];
export const initialFundingEvents: FundingEvent[] = [];
