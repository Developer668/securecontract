import { expect, test } from '@playwright/test';

test('gates all matching behind a completed lab profile', async ({page})=>{
  await page.goto('/');
  await expect(page).toHaveTitle(/FundingSecured/);
  await expect(page.getByRole('heading',{name:'Tell us what your lab can actually do.'})).toBeVisible();
  await expect(page.getByText('Scores are generated only after this profile is saved.')).toBeVisible();
  await expect(page.locator('.match-score')).toHaveCount(0);
  const response=await page.request.get('/api/funding/opportunities');
  expect(response.ok()).toBe(true);
  const body=await response.json() as {profileRequired:boolean;data:unknown[]};
  expect(body.profileRequired).toBe(true);
  expect(body.data).toEqual([]);
});

test('exposes a one-click Bright Data-only source portfolio without collector IDs',async({page})=>{
  await page.goto('/');
  await page.getByRole('button',{name:'Sources'}).click();
  await expect(page.getByRole('heading',{name:'Source portfolio'})).toBeVisible();
  await expect(page.getByText('40 US biomedical funders. Collector IDs and credentials stay server-side.')).toBeVisible();
  await expect(page.getByRole('button',{name:'Run all ready sources'})).toBeEnabled();
  await expect(page.getByText(/Collector ID returned|Paste the Collector ID/)).toHaveCount(0);
  const response=await page.request.get('/api/funding/sources');
  const body=await response.json() as {collectionBoundary:string;data:Array<Record<string,unknown>>};
  expect(body.collectionBoundary).toBe('bright_data_only');
  expect(body.data).toHaveLength(40);
  expect(body.data.every((source)=>source.collectionMethod==='bright_data')).toBe(true);
  expect(body.data.every((source)=>!('collectorId' in source))).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
