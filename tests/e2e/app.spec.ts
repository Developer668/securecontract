import { expect, test } from "@playwright/test";

test("core opportunity workflow", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Opportunities" })).toBeVisible();
  const opportunityResponse = await page.request.get("/api/opportunities");
  expect(opportunityResponse.ok()).toBe(true);
  expect((await opportunityResponse.json()).provenance).toBe("recorded_live");
  await expect(page.getByLabel("Status filter")).toHaveValue("open");
  await page.getByLabel("Status filter").selectOption("all");
  await page.getByLabel("Close detail").click();
  await expect(page.getByText("NSW Roadmap - Tender Round 9").first()).toBeVisible();
  await page.getByText("NSW Roadmap - Tender Round 9").first().click();
  await page.getByRole("button", { name: "Raw" }).click();
  await expect(page.getByText("Immutable source row")).toBeVisible();
  await expect(page.getByText("Completed Bright Data custom collector dataset run")).toBeVisible();
  await page.getByRole("button", { name: /Changes/ }).click();
  await expect(page.getByRole("heading", { name: "No material changes observed" })).toBeVisible();
  const detail = page.getByRole("complementary");
  await detail.getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("heading", { name: "Application checklist" })).toBeVisible();
  await detail.getByRole("button", { name: "Copilot", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Reason over this opportunity—not the open web." })).toBeVisible();
  await expect(page.getByText("Evidence in scope")).toBeVisible();
});

test("filters and one-click live operations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("Status filter")).toHaveValue("open");
  await page.getByLabel("Status filter").selectOption("all");
  await page.getByLabel("Country filter").selectOption("AU");
  await expect(page.getByText("Capacity Investment Scheme NEM Dispatchable").first()).toBeVisible();
  await page.getByRole("button", { name: "Operations" }).click();
  await expect(page.getByRole("heading", { name: "Sources", exact: true })).toBeVisible();
  const response = await page.request.get("/api/sources");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    data: Array<{ slug: string; latestRun: { validRowCount: number; metrics: { dateParseRate: number } } | null }>;
  };
  const asl = body.data.find((source) => source.slug === "australia-asl-tenders");
  expect(asl?.latestRun?.validRowCount).toBe(4);
  expect(asl?.latestRun?.metrics.dateParseRate).toBe(1);
  await expect(page.getByRole("button", { name: "Run all live sources" })).toBeEnabled();
  await expect(page.getByText("CanadaBuys tender opportunities")).toBeVisible();
  await expect(page.getByText("City of Chicago active solicitations")).toBeVisible();
  await expect(page.getByText("25 rows · 25 valid")).toHaveCount(2);
  await expect(page.getByText("2 verified scraper repairs")).toBeVisible();
  await expect(page.getByLabel("Operator secret")).toHaveCount(0);
});
