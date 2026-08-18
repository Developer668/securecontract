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
  {id:'src-hhmi',name:'HHMI Science Programs',organization:'Howard Hughes Medical Institute',category:'foundation',sourceUrl:'https://www.hhmi.org/programs'},
  {id:'src-rita-allen',name:'Rita Allen Foundation Grants',organization:'Rita Allen Foundation',category:'foundation',sourceUrl:'https://ritaallen.org/apply/'},
  {id:'src-pew-biomedical',name:'Pew Biomedical Programs',organization:'The Pew Charitable Trusts',category:'foundation',sourceUrl:'https://www.pew.org/en/projects/pew-biomedical-scholars'},
  {id:'src-searle',name:'Searle Scholars Competition',organization:'Searle Scholars Program',category:'foundation',sourceUrl:'https://searlescholars.org/competition/'},
  {id:'src-beckman',name:'Beckman National Grant Programs',organization:'Arnold and Mabel Beckman Foundation',category:'foundation',sourceUrl:'https://www.beckman-foundation.org/programs/'},
  {id:'src-mcknight',name:'McKnight Neuroscience Awards',organization:'McKnight Foundation',category:'foundation',sourceUrl:'https://www.mcknight.org/programs/the-mcknight-endowment-fund-for-neuroscience/'},
  {id:'src-sloan',name:'Sloan Research Fellowships',organization:'Alfred P. Sloan Foundation',category:'foundation',sourceUrl:'https://sloan.org/fellowships'},
  {id:'src-brf',name:'Brain Research Foundation Grants',organization:'Brain Research Foundation',category:'foundation',sourceUrl:'https://www.thebrf.org/for-researchers/'},
  {id:'src-keck',name:'Keck Research Grants',organization:'W. M. Keck Foundation',category:'foundation',sourceUrl:'https://www.wmkeck.org/grant-programs/research/'},
  {id:'src-phrma',name:'PhRMA Foundation Awards',organization:'PhRMA Foundation',category:'foundation',sourceUrl:'https://www.phrmafoundation.org/awards/'},
  {id:'src-thrasher',name:'Thrasher Pediatric Research Awards',organization:'Thrasher Research Fund',category:'foundation',sourceUrl:'https://www.thrasherresearch.org/early-career-award'},
  {id:'src-hfsp',name:'HFSP Research Funding',organization:'Human Frontier Science Program',category:'foundation',sourceUrl:'https://www.hfsp.org/funding'},
  {id:'src-sontag',name:'Sontag Brain Cancer Grants',organization:'The Sontag Foundation',category:'foundation',sourceUrl:'https://sontagfoundation.org/all-grants/'},
  {id:'src-concern',name:'CONCERN Cancer Research Grants',organization:'Concern Foundation',category:'foundation',sourceUrl:'https://www.concernfoundation.org/research-grants'},
  {id:'src-cri',name:'Cancer Research Institute Grants',organization:'Cancer Research Institute',category:'foundation',sourceUrl:'https://www.cancerresearch.org/fellowship-grants'},
  {id:'src-aacr',name:'AACR Research Funding',organization:'American Association for Cancer Research',category:'scientific_society',sourceUrl:'https://www.aacr.org/professionals/research-funding/'},
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
