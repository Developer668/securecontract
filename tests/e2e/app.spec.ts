import { expect, test } from "@playwright/test";

test("discovers evidence-grounded US biomedical funding", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/FundingSecured/);
  await expect(page.getByRole("heading", { name: /Find the funding your science/ })).toBeVisible();
  await expect(page.getByLabel("Ask FundingSecured")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Funding matches" })).toBeVisible();
  await expect(page.getByText("US only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "What changed" })).toBeVisible();
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(documentWidth).toBeLessThanOrEqual(viewportWidth);

  const response = await page.request.get("/api/funding/opportunities");
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as {
    provenance: string;
    data: Array<{ geography: string; provenance: string; match: { eligibility: string }; evidence: unknown[] }>;
  };
  expect(body.provenance).toBe("recorded_demo");
  expect(body.data.length).toBeGreaterThanOrEqual(6);
  expect(body.data.every((item) => item.geography === "US")).toBe(true);
  expect(body.data.every((item) => item.provenance === "recorded_demo")).toBe(true);
  expect(body.data.every((item) => item.match.eligibility !== "verified_eligible")).toBe(true);
});

test("opens fit, exact evidence, and application tasks", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("heading", { name: "NIH Research Project Grant Program (R01)" }).click();
  const drawer = page.getByRole("complementary", { name: "Funding opportunity detail" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText("Likely eligible — confirm")).toBeVisible();
  await expect(drawer.getByText("Specific NIH institute alignment")).toBeVisible();

  await drawer.getByRole("button", { name: /Evidence/ }).click();
  await expect(drawer.getByText(/Applications must fit within the mission/)).toBeVisible();
  await expect(drawer.getByRole("link", { name: "Open exact source" }).first()).toHaveAttribute("href", /^https:/);

  await drawer.getByRole("button", { name: /Plan/ }).click();
  await expect(drawer.getByText("Application timeline")).toBeVisible();
  const firstTask = drawer.getByRole("checkbox").first();
  await expect(firstTask).toBeEnabled();
  await expect(drawer.getByText("Select the participating NIH institute and exact NOFO")).toBeVisible();
});

test("provides a dedicated guide, editable lab profile, and Bright Data-only operations", async ({ page }) => {
  await page.goto("/");
  const desktopNav = page.getByRole("navigation", { name: "Primary navigation" });
  if (await desktopNav.isVisible()) {
    await desktopNav.getByRole("button", { name: "Funding guide" }).click();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".mobile-menu").getByRole("button", { name: "Funding guide" }).click();
  }
  if (await desktopNav.isVisible()) {
    await expect(page.getByRole("heading", { name: "Reason across the portfolio." })).toBeVisible();
  }
  await expect(page.getByText("NVIDIA NIM · evidence constrained")).toBeVisible();

  if (await desktopNav.isVisible()) {
    await desktopNav.getByRole("button", { name: "Lab profile" }).click();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".mobile-menu").getByRole("button", { name: "Lab profile" }).click();
  }
  await expect(page.getByRole("heading", { name: "Your science, represented with precision." })).toBeVisible();
  await expect(page.getByLabel("Lab or company name")).toHaveValue("Northstar Translational Lab");

  if (await desktopNav.isVisible()) {
    await desktopNav.getByRole("button", { name: "Collectors" }).click();
  } else {
    await page.getByRole("button", { name: "Open menu" }).click();
    await page.locator(".mobile-menu").getByRole("button", { name: "Collectors" }).click();
  }
  await expect(page.getByText("Bright Data only")).toBeVisible();
  await expect(page.getByRole("heading", { name: "8 curated sources" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Break it safely. Repair it visibly." })).toBeVisible();
  await page.getByRole("button", { name: "Connect Collector" }).first().click();
  await expect(page.getByText("Paste the Collector ID returned by Bright Data Scraper Studio.")).toBeVisible();

  const sources = await page.request.get("/api/funding/sources");
  const sourceBody = (await sources.json()) as {
    collectionBoundary: string;
    data: Array<{ collectionMethod: string; collectorId: string | null }>;
  };
  expect(sourceBody.collectionBoundary).toBe("bright_data_only");
  expect(sourceBody.data.every((item) => item.collectionMethod === "bright_data")).toBe(true);
  expect(sourceBody.data.every((item) => item.collectorId === null)).toBe(true);
});
