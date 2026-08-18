import { BrightDataClient } from '../src/lib/bright-data/client.js';
const [collectorId,inputUrl]=process.argv.slice(2);
if(!collectorId||!inputUrl)throw new Error('Usage: tsx scripts/collect-source.ts <c_collector> <public-url>');
if(!process.env.BRIGHT_DATA_API_TOKEN)throw new Error('BRIGHT_DATA_API_TOKEN is required');
const client=new BrightDataClient(process.env.BRIGHT_DATA_API_TOKEN);
const collectionId=await client.trigger(collectorId,inputUrl);
console.log(JSON.stringify({collectionId,status:'pending'}));
