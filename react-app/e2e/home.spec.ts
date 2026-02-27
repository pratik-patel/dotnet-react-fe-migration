import { test, expect } from "@playwright/test";

test("home routes are reachable", async ({ page }) => {
  await page.goto("/Home/Index");
  await expect(page.getByTestId("layout-navbar")).toBeVisible();
  await expect(page.getByTestId("home-index-inline-links")).toBeVisible();

  await page.goto("/Home/About");
  await expect(page.getByRole("heading", { name: "About this site" })).toBeVisible();

  await page.goto("/Home/Internals");
  await expect(page.getByText("InternalsInfo")).toBeVisible();
});
