import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Brain, CalendarBlank, Check, Database,
  MagnifyingGlass, PaperPlaneTilt, Pulse, ShieldCheck, SpinnerGap, Warning, X,
} from '@phosphor-icons/react';
import type { FundingEvent, FundingOpportunity, FundingSource, LabProfile } from './types';

type View = 'discover'|'guide'|'profile'|'sources';
type ClientSource = Omit<FundingSource,'collectorId'> & { collectorReady:boolean };
type ScoringState={status:'idle'|'processing'|'ready'|'failed';completed:number;total:number;model:string|null;error:string|null};
type Message = {id:string;role:'user'|'assistant';content:string;evidenceIds?:string[];opportunityIds?:string[];recordsSearched?:number;recordsRead?:number};

const emptyProfile: Omit<LabProfile,'updatedAt'> = {
  name:'', institution:'', country:'US', researchAreas:[], methods:[], careerStages:[], equipment:[],
  previousWork:[], desiredFundingMin:null, desiredFundingMax:null, collaborationPreferences:[], commercializationStage:'basic research',
};
const list=(value:string)=>value.split(',').map((entry)=>entry.trim()).filter(Boolean);
const date=(value:string|null)=>value?new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric'}).format(new Date(value)):'Not stated';
const money=(value:number|null)=>value===null?'':String(value);

function Logo(){return <span className="logo-mark" aria-hidden="true"><i/><i/><i/></span>}

function ProfileForm({profile,onSaved}:{profile:LabProfile|null;onSaved:(profile:LabProfile)=>void}){
  const [draft,setDraft]=useState<Omit<LabProfile,'updatedAt'>>(profile??emptyProfile);
  const [saving,setSaving]=useState(false);
  const setArray=(key:keyof LabProfile,value:string)=>setDraft((current)=>({...current,[key]:list(value)}));
  const submit=async(event:React.FormEvent)=>{
    event.preventDefault();setSaving(true);
    const response=await fetch('/api/funding/profile',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(draft)});
    const body=await response.json() as {data?:LabProfile;error?:unknown};
    setSaving(false);if(response.ok&&body.data)onSaved(body.data);
  };
  return <main className="profile-onboarding">
    <header><span className="step">01 · Lab profile</span><h1>Tell us what your lab can actually do.</h1><p>Matching stays off until this profile is complete. FundingSecured never invents missing capabilities or institutional facts.</p></header>
    <form onSubmit={submit}>
      <div className="form-grid">
        <label>Lab or company name<input required value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></label>
        <label>Institution or entity type<input required value={draft.institution} onChange={(e)=>setDraft({...draft,institution:e.target.value})} placeholder="Independent research institute, university, US small business…"/></label>
        <label className="wide">Research areas<textarea required value={draft.researchAreas.join(', ')} onChange={(e)=>setArray('researchAreas',e.target.value)} placeholder="Biomedical imaging, oncology, diagnostics…"/></label>
        <label className="wide">Methods<textarea required value={draft.methods.join(', ')} onChange={(e)=>setArray('methods',e.target.value)} placeholder="Machine learning, microscopy, wet-lab assays…"/></label>
        <label className="wide">Equipment and credible access<textarea value={draft.equipment.join(', ')} onChange={(e)=>setArray('equipment',e.target.value)} placeholder="Sequencer, 3T MRI access, GPU compute…"/></label>
        <label className="wide">Previous projects or publications<textarea required value={draft.previousWork.join(', ')} onChange={(e)=>setArray('previousWork',e.target.value)} placeholder="Titles, PMIDs, or concise project descriptions…"/></label>
        <label>Team career stages<input required value={draft.careerStages.join(', ')} onChange={(e)=>setArray('careerStages',e.target.value)} placeholder="Postdoc, early-career PI…"/></label>
        <label>Commercialization stage<select value={draft.commercializationStage} onChange={(e)=>setDraft({...draft,commercializationStage:e.target.value})}><option>basic research</option><option>proof of concept</option><option>validated prototype</option><option>clinical validation</option><option>early revenue</option></select></label>
        <label>Minimum funding sought<input type="number" min="0" value={money(draft.desiredFundingMin)} onChange={(e)=>setDraft({...draft,desiredFundingMin:e.target.value?Number(e.target.value):null})}/></label>
        <label>Maximum funding sought<input type="number" min="0" value={money(draft.desiredFundingMax)} onChange={(e)=>setDraft({...draft,desiredFundingMax:e.target.value?Number(e.target.value):null})}/></label>
        <label className="wide">Collaboration preferences<input value={draft.collaborationPreferences.join(', ')} onChange={(e)=>setArray('collaborationPreferences',e.target.value)} placeholder="Academic medical center, clinical site, small business…"/></label>
      </div>
      <footer><p><ShieldCheck/> Scores are generated only after this profile is saved.</p><button disabled={saving}>{saving?<SpinnerGap className="spin"/>:<ArrowRight/>}{profile?'Update profile':'Start matching'}</button></footer>
    </form>
  </main>;
}

function OpportunityCard({item,onOpen}:{item:FundingOpportunity;onOpen:()=>void}){
  return <button className="funding-row" onClick={onOpen}>
    {item.match.status==='pending'?<span className="match-pending"><SpinnerGap className="spin"/><small>reading JSON</small></span>:<span className="match-score">{item.match.score}<small>AI match</small></span>}
    <span className="funding-copy"><small>{item.funder}</small><strong>{item.title}</strong><span>{item.match.explanation}</span></span>
    <span className="funding-meta"><small>{item.amountText}</small><strong><CalendarBlank/>{date(item.deadline)}</strong></span>
    <ArrowRight className="row-arrow"/>
  </button>;
}

function Detail({item,onClose}:{item:FundingOpportunity;onClose:()=>void}){
  return <div className="dialog-backdrop" onMouseDown={(e)=>e.target===e.currentTarget&&onClose()}><aside className="detail-dialog" aria-label="Funding opportunity detail">
    <button className="dialog-close" onClick={onClose} aria-label="Close"><X/></button>
    <p className="step">{item.funder}</p><h2>{item.title}</h2>
    <div className="detail-summary"><strong>{item.match.status==='pending'?'Analyzing grant JSON':`${item.match.score}% AI match`}</strong><span>{item.match.eligibility.replaceAll('_',' ')}</span><span>{item.amountText}</span><span>{date(item.deadline)}</span></div>
    <p>{item.match.explanation}</p>
    <p className="score-accountability">{item.match.status==='ai_scored'?`Scored from this record and the saved profile by ${item.match.model}.`:`${item.match.status==='pending'?'AI analysis is in progress.':'Conservative fallback score — AI scoring was unavailable.'}`}</p>
    <h3>Relevant capabilities</h3><div className="tags">{item.match.relevantCapabilities.map((entry)=><span key={entry}><Check/>{entry}</span>)}</div>
    <h3>Missing information</h3><ul>{item.match.missingInformation.map((entry)=><li key={entry}><Warning/>{entry}</li>)}</ul>
    <h3>Collected evidence passages</h3><div className="passages">{item.evidence.map((entry)=><a key={entry.id} href={entry.sourceUrl} target="_blank" rel="noreferrer"><small>{entry.field}</small><q>{entry.passage}</q></a>)}</div>
    <details className="raw-record"><summary>View collected grant JSON</summary><pre>{JSON.stringify(item.raw??{},null,2)}</pre></details>
    <a className="official-link" href={item.detailUrl} target="_blank" rel="noreferrer">Open official opportunity <ArrowRight/></a>
  </aside></div>;
}

function Discovery({profile,items,scoring,onSources}:{profile:LabProfile;items:FundingOpportunity[];scoring:ScoringState;onSources:()=>void}){
  const [query,setQuery]=useState('');const [selected,setSelected]=useState<FundingOpportunity|null>(null);
  const filtered=useMemo(()=>{const q=query.toLowerCase();return items.filter((item)=>[item.title,item.funder,item.summary,...item.researchAreas].join(' ').toLowerCase().includes(q))},[items,query]);
  return <main className="workspace">
    <header className="workspace-head"><div><span className="step">US biomedical funding · deduplicated</span><h1>{profile.name}</h1><p>{items.length?`${items.length} unique opportunities retained from Bright Data. ${scoring.status==='processing'?`AI has read ${scoring.completed} of ${scoring.total}.`:'Scores reflect the current saved profile.'}`:'No live records yet. Run the source portfolio to begin matching.'}</p></div><button className="primary" onClick={onSources}><Pulse/>Refresh sources</button></header>
    {scoring.status==='processing'&&<div className="analysis-status"><SpinnerGap className="spin"/><div><strong>Reading full grant records</strong><span>{scoring.completed} / {scoring.total} analyzed with {scoring.model}</span></div><progress value={scoring.completed} max={Math.max(1,scoring.total)}/></div>}
    <div className="search"><MagnifyingGlass/><input aria-label="Search live funding" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search live opportunities, funders, or research areas"/><span>{filtered.length} results</span></div>
    {filtered.length?<section className="funding-list">{filtered.map((item)=><OpportunityCard key={item.id} item={item} onOpen={()=>setSelected(item)}/>)}</section>:<section className="empty-live"><Database/><h2>Your live feed is empty.</h2><p>Complete a Bright Data run. Scores will appear here only for accepted records and this saved lab profile.</p><button onClick={onSources}>Open source portfolio <ArrowRight/></button></section>}
    {selected&&<Detail item={selected} onClose={()=>setSelected(null)}/>}
  </main>;
}

function Sources({sources,configured,events,onRefresh}:{sources:ClientSource[];configured:boolean;events:FundingEvent[];onRefresh:()=>Promise<void>}){
  const [running,setRunning]=useState<string[]>([]);const [status,setStatus]=useState('');
  const poll=async(collectionId:string)=>{for(let attempt=0;attempt<90;attempt++){await new Promise((resolve)=>setTimeout(resolve,2000));const response=await fetch(`/api/funding/runs/${encodeURIComponent(collectionId)}`);if(response.status===202)continue;return response.ok}return false};
  const runOne=async(source:ClientSource)=>{setRunning([source.id]);setStatus(`Running ${source.name}…`);const response=await fetch(`/api/funding/runs/${source.id}`,{method:'POST'});const body=await response.json() as {collectionId?:string;error?:string};if(!response.ok||!body.collectionId){setStatus(body.error??'Run failed');setRunning([]);return}await poll(body.collectionId);await onRefresh();setRunning([]);setStatus(`${source.name} finished.`)};
  const runAll=async()=>{setRunning(sources.filter((source)=>source.collectorReady).map((source)=>source.id));setStatus('Starting the live portfolio…');const response=await fetch('/api/funding/runs',{method:'POST'});const body=await response.json() as {triggered?:Array<{collectionId:string}>;error?:string};if(!response.ok||!body.triggered){setStatus(body.error??'Run failed');setRunning([]);return}setStatus(`${body.triggered.length} Bright Data source runs in progress…`);await Promise.all(body.triggered.map((run)=>poll(run.collectionId)));await onRefresh();setRunning([]);setStatus('Portfolio refresh complete.')};
  return <main className="workspace sources-page">
    <header className="workspace-head"><div><span className="step">Bright Data collection</span><h1>Source portfolio</h1><p>{sources.length} US biomedical funders. Collector IDs and credentials stay server-side.</p></div><button className="primary" disabled={!configured||running.length>0||!sources.some((source)=>source.collectorReady)} onClick={()=>void runAll()}>{running.length?<SpinnerGap className="spin"/>:<Pulse/>}Run all ready sources</button></header>
    {status&&<div className="run-status"><Pulse/>{status}</div>}
    <section className="source-table"><header><span>Source</span><span>Records</span><span>Last run</span><span/></header>{sources.map((source)=><article key={source.id}><div><span className={`source-dot ${source.collectorReady?'ready':''}`}/><p><strong>{source.name}</strong><small>{source.organization}</small></p></div><strong>{source.recordCount}</strong><span>{source.lastRunAt?date(source.lastRunAt):source.collectorReady?'Ready':'Provisioning'}</span><button disabled={!source.collectorReady||running.length>0} onClick={()=>void runOne(source)}>{running.includes(source.id)?<SpinnerGap className="spin"/>:<Pulse/>}{source.collectorReady?'Run':'Provisioning'}</button></article>)}</section>
    {events.length>0&&<section className="recent-events"><h2>Recent collection activity</h2>{events.slice(0,5).map((event)=><p key={event.id}><span>{event.title}</span><small>{event.body}</small></p>)}</section>}
  </main>;
}

function Guide({items}:{items:FundingOpportunity[]}){
  const [messages,setMessages]=useState<Message[]>([{id:'welcome',role:'assistant',content:'I am your funding-fit specialist. Describe your research goal, institution, stage, budget, or deadline and I will retrieve the most relevant saved grant records, read their evidence and official links, then explain the decision.'}]);
  const [question,setQuestion]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const evidence=new Map(items.flatMap((item)=>item.evidence).map((entry)=>[entry.id,entry]));const opportunities=new Map(items.map((item)=>[item.id,item]));
  const send=async()=>{const prompt=question.trim();if(!prompt||busy)return;const history=messages.filter((message)=>message.id!=='welcome').slice(-6).map((message)=>({role:message.role,content:message.content}));setQuestion('');setError('');setBusy(true);setMessages((current)=>[...current,{id:crypto.randomUUID(),role:'user',content:prompt}]);try{const response=await fetch('/api/funding/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:prompt,opportunityIds:[],history})});const body=await response.json() as {answer?:string;error?:string;evidenceIds?:string[];opportunityIds?:string[];recordsSearched?:number;recordsRead?:number};if(!response.ok)throw new Error(body.error??'The funding specialist is unavailable');setMessages((current)=>[...current,{id:crypto.randomUUID(),role:'assistant',content:body.answer??'The guide could not answer.',evidenceIds:body.evidenceIds,opportunityIds:body.opportunityIds,recordsRead:body.recordsRead,recordsSearched:body.recordsSearched}]);}catch(caught){setError(caught instanceof Error?caught.message:'The funding specialist is unavailable')}finally{setBusy(false)}};
  const examples=['Which grants fit a cancer-imaging lab seeking $250k?','Compare open opportunities for an early-career PI.','What should I verify before applying to the best match?'];
  return <main className="chat-page"><header><Brain/><div><strong>Funding fit specialist</strong><small>Fast NVIDIA NIM retrieval over persisted grant records and official links</small></div></header><section>{messages.map((message)=><article key={message.id} className={message.role}><span>{message.role==='assistant'?<Logo/>:'You'}</span><div><p>{message.content}</p>{message.opportunityIds?.length?<div className="grant-links">{message.opportunityIds.map((id)=>{const item=opportunities.get(id);return item?<a key={id} href={item.detailUrl} target="_blank" rel="noreferrer"><strong>{item.title}</strong><small>{item.funder} · {item.amountText} · Official record ↗</small></a>:null})}</div>:null}{message.evidenceIds?.length?<footer>{message.evidenceIds.map((id,index)=>{const entry=evidence.get(id);return entry?<a key={id} href={entry.sourceUrl} target="_blank" rel="noreferrer">Evidence {index+1} · {entry.field}</a>:null})}</footer>:null}{message.recordsSearched!==undefined?<small className="search-accountability">Searched {message.recordsSearched} saved records · read {message.recordsRead} full records</small>:null}</div></article>)}{!messages.some((message)=>message.role==='user')&&<div className="chat-prompts">{examples.map((example)=><button key={example} onClick={()=>setQuestion(example)}>{example}</button>)}</div>}{busy&&<p className="thinking"><SpinnerGap className="spin"/>Retrieving grants and official source context…</p>}{error&&<p className="chat-error" role="alert">{error}</p>}</section><form onSubmit={(e)=>{e.preventDefault();void send()}}><textarea aria-label="Ask FundingSecured" value={question} onChange={(e)=>setQuestion(e.target.value)} placeholder={items.length?'Ask what funding best fits and why…':'Run sources before asking about grants…'} disabled={!items.length}/><button disabled={!items.length||busy||question.trim().length<2}><PaperPlaneTilt/></button></form></main>;
}

export default function App(){
  const [view,setView]=useState<View>('discover');const [profile,setProfile]=useState<LabProfile|null>(null);const [items,setItems]=useState<FundingOpportunity[]>([]);const [sources,setSources]=useState<ClientSource[]>([]);const [events,setEvents]=useState<FundingEvent[]>([]);const [configured,setConfigured]=useState(false);const [scoring,setScoring]=useState<ScoringState>({status:'idle',completed:0,total:0,model:null,error:null});const [loading,setLoading]=useState(true);
  const refresh=useCallback(async()=>{const [p,o,s,e,a]=await Promise.all([fetch('/api/funding/profile').then((r)=>r.json()),fetch('/api/funding/opportunities').then((r)=>r.json()),fetch('/api/funding/sources').then((r)=>r.json()),fetch('/api/funding/event-history').then((r)=>r.json()),fetch('/api/funding/scoring-status').then((r)=>r.json())]);setProfile(p.data);setItems(o.data);setSources(s.data);setConfigured(s.brightDataConfigured);setEvents(e.data);setScoring(a.data);setLoading(false)},[]);
  useEffect(()=>{let active=true;const load=async()=>{while(active){try{await refresh();return}catch{await new Promise((resolve)=>setTimeout(resolve,500))}}};queueMicrotask(()=>void load());return()=>{active=false}},[refresh]);
  useEffect(()=>{const stream=new EventSource('/api/funding/events');stream.addEventListener('funding',(event)=>{const value=JSON.parse((event as MessageEvent).data) as FundingEvent;setEvents((current)=>[value,...current.filter((item)=>item.id!==value.id)]);void refresh()});return()=>stream.close()},[refresh]);
  useEffect(()=>{if(scoring.status!=='processing')return;const timer=setInterval(()=>void refresh(),1500);return()=>clearInterval(timer)},[scoring.status,refresh]);
  if(loading)return <main className="loading"><Logo/><span>Loading FundingSecured</span></main>;
  const go=(next:View)=>setView(next);
  return <div className="app"><header className="topbar"><button className="brand" onClick={()=>go('discover')}><Logo/>FundingSecured</button><nav>{profile&&<button className={view==='discover'?'active':''} onClick={()=>go('discover')}>Funding</button>}<button className={view==='profile'?'active':''} onClick={()=>go('profile')}>Lab profile</button><button className={view==='sources'?'active':''} onClick={()=>go('sources')}>Sources</button>{profile&&<button className={view==='guide'?'active':''} onClick={()=>go('guide')}>Ask AI</button>}</nav></header>
    {view==='sources'?<Sources sources={sources} configured={configured} events={events} onRefresh={refresh}/>:!profile||view==='profile'?<ProfileForm profile={profile} onSaved={(saved)=>{setProfile(saved);void refresh();setView('discover')}}/>:view==='discover'?<Discovery profile={profile} items={items} scoring={scoring} onSources={()=>go('sources')}/>:<Guide items={items}/>}
  </div>;
}
