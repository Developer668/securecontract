import { readFile } from 'node:fs/promises';
import { validateRun } from '../src/lib/validation.js';
const [file]=process.argv.slice(2); if(!file)throw new Error('Usage: tsx scripts/validate-source.ts <metrics.json>');
console.log(JSON.stringify(validateRun(JSON.parse(await readFile(file,'utf8'))),null,2));
