export {};
const apiBase=process.env.FUNDING_API_BASE ?? 'http://127.0.0.1:8797';
const interval=Number(process.env.FUNDING_LOOP_INTERVAL_MS ?? 900_000);
const sleep=(ms:number)=>new Promise((resolve)=>setTimeout(resolve,ms));

async function runCycle(){
  const response=await fetch(`${apiBase}/api/funding/runs`,{method:'POST'});
  const body=await response.json() as {triggered?:Array<{collectionId:string}>;error?:string};
  if(!response.ok||!body.triggered)throw new Error(body.error??`Funding run failed (${response.status})`);
  const pollOne=async(run:{collectionId:string})=>{
    for(let attempt=0;attempt<120;attempt++){
      await sleep(2500);
      const poll=await fetch(`${apiBase}/api/funding/runs/${encodeURIComponent(run.collectionId)}`);
      if(poll.status===202)continue;
      return true;
    }
    return false;
  };
  const finished=(await Promise.all(body.triggered.map(pollOne))).filter(Boolean).length;
  const sources=await (await fetch(`${apiBase}/api/funding/sources`)).json() as {data?:Array<{recordCount:number;lastRunStatus:string}>};
  const records=(sources.data??[]).reduce((sum,source)=>sum+source.recordCount,0);
  console.log(JSON.stringify({at:new Date().toISOString(),triggered:body.triggered.length,finished,sourceRecords:records,nextRunInMs:interval}));
}

while(true){
  try{await runCycle();}catch(error){console.error(JSON.stringify({at:new Date().toISOString(),error:error instanceof Error?error.message:'funding loop failed'}));}
  await sleep(interval);
}
