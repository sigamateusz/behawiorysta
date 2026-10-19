// risk: test-plan.md #3 — a client session lands on /consultations, a behaviorist session on /dashboard
// facet: rendered list and calendar after a real sign-in; the signed-out redirect is covered by seed.spec.ts
// seed: tests/e2e/seed.spec.ts
// The sign-in form is the action under test. A storageState from .env would skip the redirect this risk protects.
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const password = "E2e-Post-Login-Passw0rd!";
const createdEmails: string[] = [];

test.describe("risk #3 post-login screen", () => {
  test.describe.configure({ timeout: 60_000 });

  test.afterEach(() => {
    for (const email of createdEmails.splice(0)) {
      removeAccount(email);
    }
  });

  test("client session lands on the empty consultations list", async ({ page, request }) => {
    const email = freshEmail("client");

    // Fresh client through POST /api/auth/signup, the same fields smoke sends.
    await signUp(request, email);

    // Sign in through the form in this test's own context. The island drops input typed before hydration.
    await signIn(page, email);

    await expect(page).toHaveURL(/\/consultations$/);
    await expect(page.getByRole("heading", { name: "Moje zgłoszenia", exact: true })).toBeVisible();
    await expect(page.getByText("Nie masz jeszcze żadnych zgłoszeń.", { exact: true })).toBeVisible();
  });

  test("behaviorist session lands on the calendar", async ({ page, request }) => {
    const email = freshEmail("behaviorist");

    // Fresh account, then the same local role update smoke uses to promote a behaviorist.
    await signUp(request, email);
    promoteBehaviorist(email);

    // Sign in through the form in this test's own context. The island drops input typed before hydration.
    await signIn(page, email);

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("link", { name: "Poprzedni miesiąc", exact: true })).toBeVisible();
  });
});

function freshEmail(role: "client" | "behaviorist"): string {
  const email = `e2e-${role}-${randomUUID()}@example.com`;
  createdEmails.push(email);
  test.info().annotations.push({ type: "test-data", description: email });
  return email;
}

function appOrigin(): string {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) {
    throw new Error("Playwright baseURL is not set");
  }
  return new URL(baseURL).origin;
}

async function signUp(request: APIRequestContext, email: string): Promise<void> {
  const response = await request.post("/api/auth/signup", {
    form: { email, password },
    headers: { Origin: appOrigin() },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toMatch(/\/auth\/confirm-email$/);
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth/signin");
  await expect(async () => {
    await page.getByRole("textbox", { name: "Email", exact: true }).fill("");
    await page.getByRole("textbox", { name: "Email", exact: true }).fill(email);
    await page.getByRole("textbox", { name: "Password", exact: true }).fill("");
    await page.getByRole("textbox", { name: "Password", exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"), { timeout: 5_000 });
  }).toPass();
}

function sqlLiteral(value: string): string {
  return value.replaceAll("'", "''");
}

function queryLocal(sql: string): { status: number; stdout: string; detail: string } {
  const cwd = process.cwd();
  const result =
    process.platform === "win32"
      ? spawnSync(
          process.env.ComSpec ?? "cmd.exe",
          ["/d", "/s", "/c", `npx supabase db query --local "${sql.replaceAll('"', '""')}"`],
          { cwd, encoding: "utf8", windowsHide: true, windowsVerbatimArguments: true },
        )
      : spawnSync("npx", ["supabase", "db", "query", "--local", sql], { cwd, encoding: "utf8" });
  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const stderr = typeof result.stderr === "string" ? result.stderr : "";
  const message = result.error instanceof Error ? result.error.message : "";
  const detail = [stdout, stderr, message]
    .filter((part) => part.length > 0)
    .join("\n")
    .trim();
  return { status: result.status === 0 ? 0 : (result.status ?? 1), stdout, detail };
}

function promoteBehaviorist(email: string): void {
  const emailLiteral = sqlLiteral(email);
  const promoted = queryLocal(
    "update public.profiles set role = 'behaviorist' where id = (select id from auth.users where email = '" +
      emailLiteral +
      "');",
  );
  expect(promoted.status, promoted.detail).toBe(0);
  expect(promoted.stdout).toContain("UPDATE 1");
}

function removeAccount(email: string): void {
  const emailLiteral = sqlLiteral(email);
  const deleted = queryLocal(`delete from auth.users where email = '${emailLiteral}';`);
  expect(deleted.status, deleted.detail).toBe(0);
  const left = queryLocal(`select email from auth.users where email = '${emailLiteral}';`);
  expect(left.status, left.detail).toBe(0);
  expect(left.stdout.replace(/\s+/g, "")).toContain('"rows":[]');
}
