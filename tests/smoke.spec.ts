import { expect, test } from "@playwright/test";

// Requires a dev server running with ACCESS_CODE=move-demo.
test("core Move CA Engine workflows render and produce outputs", async ({ page }) => {
  test.setTimeout(180000);

  await page.goto("http://localhost:3000/login");
  await page.getByPlaceholder("Team access code").fill("move-demo");
  await page.getByRole("button", { name: /Enter the engine/ }).click();
  await expect(page.getByText("MOVE CA ENGINE").first()).toBeVisible();
  await page.screenshot({ path: "work/screenshots/dashboard.png", fullPage: true });

  await page.goto("http://localhost:3000/dashboard/lead-qualifier");
  await page.getByLabel("Brand name").fill("Bright Bottle Co");
  await page.getByLabel("Pasted notes").fill("DTC physical goods brand selling on Shopify and Amazon. Founder is managing supplier lead times, inventory stockouts, freight costs, and SKU growth across the US.");
  await page.getByRole("button", { name: "Analyze lead" }).click();
  await expect(page.getByRole("heading", { name: "CRM-ready summary" })).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "work/screenshots/lead-qualifier.png", fullPage: true });

  await page.goto("http://localhost:3000/dashboard/call-prep");
  await page.getByLabel("Company name").fill("Bright Bottle Co");
  await page.getByLabel("Revenue").fill("$10M to $25M");
  await page.getByLabel("SKU count").fill("180 SKUs");
  await page.getByLabel("Selling platforms").fill("Shopify, Amazon, retail");
  await page.getByLabel("Booking form or intake answers").fill("They have supplier lead time issues, stockouts, freight cost pressure, and a US 3PL with limited visibility. Founder wants a better planning rhythm before the next PO.");
  await page.getByRole("button", { name: "Generate battle card" }).click();
  await expect(page.getByText("Diagnostic questions")).toBeVisible({ timeout: 60000 });
  await page.screenshot({ path: "work/screenshots/call-prep.png", fullPage: true });

  await page.goto("http://localhost:3000/dashboard/proposal-studio");
  await page.getByRole("button", { name: "Extract discovery facts" }).click();
  await expect(page.getByText("Extracted Facts")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Generate current section" }).click();
  await expect(page.getByText("Proposal guide checks")).toBeVisible({ timeout: 60000 });
  await page.getByRole("button", { name: "Approve section" }).click();
  await expect(page.getByText("Section 2: Package Summary")).toBeVisible();
  await page.screenshot({ path: "work/screenshots/proposal-studio.png", fullPage: true });

  await page.goto("http://localhost:3000/dashboard/market-signals");
  await expect(page.getByText("Demand Pulse").first()).toBeVisible({ timeout: 30000 });
  await expect(page.getByText("Demand Pulse Trend")).toBeVisible();
  await expect(page.getByText("Quick Data Summary")).toBeVisible();
  await expect(page.getByText("Forecast Reference Basis")).toBeVisible();
  await expect(page.getByText("Public data sources")).toBeVisible();
  await expect(page.getByRole("heading", { name: "US Consumer Sentiment" })).toBeVisible();
  await expect(page.getByText("Campaign Signal").first()).toBeVisible();
  await expect(page.getByText("What changed this week")).toBeVisible({ timeout: 60000 });
  await expect(page.getByText("What it means for $1M to $50M DTC brands")).toBeVisible();
  await expect(page.getByText("What Move should campaign on now")).toBeVisible();
  await page.screenshot({ path: "work/screenshots/market-signals.png", fullPage: true });
});
