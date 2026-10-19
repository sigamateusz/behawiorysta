// risk: auth-gate-redirect — a signed-out visit to a protected route lands on sign-in
import { test, expect } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

test("signed-out visit to the dashboard redirects to sign in", async ({ page }) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(/\/auth\/signin$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

  // No data created — nothing to clean up.
});
