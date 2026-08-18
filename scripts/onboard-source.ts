import { assertPublicHttpUrl } from '../src/lib/security.js';
const [url]=process.argv.slice(2); if(!url)throw new Error('Usage: tsx scripts/onboard-source.ts <public-url>');
const parsed=assertPublicHttpUrl(url);
console.log(JSON.stringify({url:parsed.href,gate:'manual_review_required',checks:['public access','no restricted data','prebuilt library','sample structured output','official detail URL']},null,2));
