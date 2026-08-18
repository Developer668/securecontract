export interface RunMetrics { rowCount:number; baselineRowCount:number | null; requiredFieldCompleteness:number; dateParseRate:number; duplicateRate:number; schemaStability:number; freshness:number; accessWallDetected:boolean; }
export interface RunValidation { accepted:boolean; health:'healthy'|'warning'|'degraded'; score:number; problems:string[]; }

export function validateRun(metrics: RunMetrics): RunValidation {
  const problems:string[] = [];
  if (metrics.rowCount === 0) problems.push('Zero-row anomaly');
  if (metrics.baselineRowCount && metrics.rowCount / metrics.baselineRowCount < .5) problems.push('Volume collapsed by more than 50%');
  if (metrics.requiredFieldCompleteness < .9) problems.push('Required-field completeness below 90%');
  if (metrics.dateParseRate < .9) problems.push('Critical date parse rate below 90%');
  if (metrics.duplicateRate > .1) problems.push('Duplicate rate above 10%');
  if (metrics.schemaStability < .8) problems.push('Unexpected schema drift');
  if (metrics.accessWallDetected) problems.push('Login or access wall detected');
  const score = Math.round((metrics.requiredFieldCompleteness*.3 + metrics.dateParseRate*.25 + Math.min(1, metrics.baselineRowCount ? metrics.rowCount/metrics.baselineRowCount : 1)*.2 + metrics.schemaStability*.15 + metrics.freshness*.1)*100);
  const accepted = !metrics.accessWallDetected && metrics.rowCount > 0 && !(metrics.baselineRowCount && metrics.rowCount / metrics.baselineRowCount < .5) && metrics.requiredFieldCompleteness >= .8 && metrics.dateParseRate >= .8;
  return { accepted, score, problems, health: accepted ? (score >= 90 ? 'healthy' : 'warning') : 'degraded' };
}
