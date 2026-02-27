import { test, expect } from "@playwright/test";

test("posts index and create form render", async ({ page }) => {
  await page.goto("/Posts/Index");
  await expect(page.getByTestId("posts-top-links")).toBeVisible();
  await expect(page.getByTestId("posts-grid")).toBeVisible();

  await page.goto("/Posts/Create");
  await expect(page.getByTestId("posts-form")).toBeVisible();
});
