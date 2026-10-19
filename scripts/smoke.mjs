// Smoke test: proves the built app, the Cloudflare adapter, Supabase auth, and the client booking flow still work together.
// Zero npm dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs
// Behaviorist promotion runs `npx supabase db query --local` from the repository and needs the local Supabase stack.

import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const stamp = Date.now();
const email = `smoke-${stamp}@example.com`;
const emailA = `smoke-a-${stamp}@example.com`;
const emailB = `smoke-b-${stamp}@example.com`;
const emailBehaviorist = `smoke-behaviorist-${stamp}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const dogName = `Smoke-${stamp}`;
const shortGoals = ` ${"x".repeat(19)} `;
const jar = new Map();
const jarA = new Map();
const jarB = new Map();
const jarBehaviorist = new Map();
const jarAnon = new Map();

let blockedSlot = "";
let bookedSlot = "";
let bookedId = "";

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function storeCookies(response, cookieJar) {
  for (const raw of response.headers.getSetCookie()) {
    const [pair, ...attrs] = raw.split(";");
    const [name, ...rest] = pair.split("=");
    const expired = attrs.some((a) => /max-age=0/i.test(a.trim()));
    if (expired) cookieJar.delete(name.trim());
    else cookieJar.set(name.trim(), rest.join("="));
  }
}

async function request(path, { method = "GET", form, jar: cookieJar = jar } = {}) {
  const response = await fetch(BASE_URL + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookieHeader(cookieJar),
      Origin: BASE_URL,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  storeCookies(response, cookieJar);
  return { status: response.status, location: response.headers.get("location") ?? "", body: await response.text() };
}

function surveyForm(slotStart, name = dogName) {
  return {
    dog_name: name,
    breed: "Beagle",
    age_years: "2",
    age_months: "0",
    basic_info: "Pies smoke testu",
    goals: "Praca nad spokojnym witaniem gosci w domu",
    slot_start: slotStart,
  };
}

function warsawBlockFields(slotStart) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(slotStart));
  const part = (type) => parts.find((item) => item.type === type)?.value ?? "";
  return {
    day: `${part("year")}-${part("month")}-${part("day")}`,
    hour: String(Number(part("hour"))),
  };
}

function queryLocal(sql) {
  if (process.platform === "win32") {
    const command = `npx supabase db query --local "${sql.replaceAll('"', '""')}"`;
    return spawnSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", command], {
      cwd: repoRoot,
      encoding: "utf8",
      windowsHide: true,
      windowsVerbatimArguments: true,
    });
  }
  return spawnSync("npx", ["supabase", "db", "query", "--local", sql], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

function promoteBehaviorist(accountEmail) {
  const emailLiteral = accountEmail.replaceAll("'", "''");
  const sql =
    "update public.profiles set role = 'behaviorist' where id = (select id from auth.users where email = '" +
    emailLiteral +
    "');";
  const result = queryLocal(sql);
  const detail = [result.stdout, result.stderr, result.error?.message].filter(Boolean).join("\n").trim();
  return {
    status: result.status === 0 ? 0 : (result.status ?? 1),
    location: result.status === 0 ? "" : detail.replace(/\s+/g, " ").slice(0, 300),
    body: detail,
  };
}

function stepPassed(actual, expected) {
  if (actual.status !== expected.status) return false;
  if (expected.location !== undefined && !actual.location.startsWith(expected.location)) return false;
  if (expected.locationExcludes !== undefined && actual.location.includes(expected.locationExcludes)) return false;
  if (expected.bodyIncludes !== undefined && !actual.body.includes(expected.bodyIncludes)) return false;
  if (expected.bodyExcludes !== undefined && actual.body.includes(expected.bodyExcludes)) return false;
  if (expected.json !== undefined) {
    try {
      if (!expected.json(JSON.parse(actual.body))) return false;
    } catch {
      return false;
    }
  }
  return true;
}

const steps = [
  ["home renders", () => request("/"), { status: 200 }],
  ["dashboard redirects anonymous user", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email, password } }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "signin rejects wrong password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password: "wrong" } }),
    { status: 302, location: "/auth/signin?error=" },
  ],
  [
    "signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email, password } }),
    { status: 302, location: "/consultations" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 302, location: "/consultations" }],
  ["signout clears session", () => request("/api/auth/signout", { method: "POST" }), { status: 302, location: "/" }],
  ["dashboard redirects after signout", () => request("/dashboard"), { status: 302, location: "/auth/signin" }],
  [
    "consultations redirects anonymous user",
    () => request("/consultations", { jar: jarAnon }),
    { status: 302, location: "/auth/signin" },
  ],
  [
    "A signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email: emailA, password }, jar: jarA }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "A signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email: emailA, password }, jar: jarA }),
    { status: 302, location: "/consultations" },
  ],
  ["A consultation form renders", () => request("/consultations/new", { jar: jarA }), { status: 200 }],
  [
    "A lists available slots",
    async () => {
      const actual = await request("/api/consultations/slots", { jar: jarA });
      try {
        const slots = JSON.parse(actual.body).slots;
        blockedSlot = Array.isArray(slots) && typeof slots[0] === "string" ? slots[0] : "";
        bookedSlot = Array.isArray(slots) && typeof slots[1] === "string" ? slots[1] : "";
      } catch {
        blockedSlot = "";
        bookedSlot = "";
      }
      return actual;
    },
    {
      status: 200,
      json: (data) =>
        Array.isArray(data.slots) && data.slots.length >= 2 && data.slots.every((slot) => typeof slot === "string"),
    },
  ],
  [
    "A incomplete survey is rejected",
    () => request("/api/consultations", { method: "POST", form: { dog_name: "" }, jar: jarA }),
    { status: 400 },
  ],
  [
    "A short goals are rejected",
    () =>
      request("/api/consultations", {
        method: "POST",
        form: { ...surveyForm(bookedSlot, `Short-${stamp}`), goals: shortGoals },
        jar: jarA,
      }),
    { status: 400 },
  ],
  [
    "A consultations list hides the short goals dog",
    () => request("/consultations", { jar: jarA }),
    { status: 200, bodyExcludes: `Short-${stamp}` },
  ],
  [
    "behaviorist signup creates account",
    () =>
      request("/api/auth/signup", {
        method: "POST",
        form: { email: emailBehaviorist, password },
        jar: jarBehaviorist,
      }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  ["behaviorist role is promoted", () => promoteBehaviorist(emailBehaviorist), { status: 0 }],
  [
    "behaviorist signin reaches dashboard",
    () =>
      request("/api/auth/signin", {
        method: "POST",
        form: { email: emailBehaviorist, password },
        jar: jarBehaviorist,
      }),
    { status: 302, location: "/dashboard" },
  ],
  [
    "behaviorist blocks the first slot hour",
    () =>
      request("/api/availability-blocks", {
        method: "POST",
        form: warsawBlockFields(blockedSlot),
        jar: jarBehaviorist,
      }),
    { status: 303, location: "/dashboard", locationExcludes: "block_error" },
  ],
  [
    "A cannot book the blocked slot",
    () =>
      request("/api/consultations", {
        method: "POST",
        form: surveyForm(blockedSlot, `Blocked-${stamp}`),
        jar: jarA,
      }),
    { status: 409 },
  ],
  [
    "A consultations list hides the blocked dog",
    () => request("/consultations", { jar: jarA }),
    { status: 200, bodyExcludes: `Blocked-${stamp}` },
  ],
  [
    "A books the second slot",
    async () => {
      const actual = await request("/api/consultations", { method: "POST", form: surveyForm(bookedSlot), jar: jarA });
      try {
        const data = JSON.parse(actual.body);
        bookedId = typeof data.id === "string" ? data.id : "";
      } catch {
        bookedId = "";
      }
      return actual;
    },
    { status: 201, json: (data) => typeof data.id === "string" && data.id.length > 0 },
  ],
  [
    "A consultations list shows the dog",
    () => request("/consultations", { jar: jarA }),
    { status: 200, bodyIncludes: dogName },
  ],
  [
    "B signup creates account",
    () => request("/api/auth/signup", { method: "POST", form: { email: emailB, password }, jar: jarB }),
    { status: 302, location: "/auth/confirm-email" },
  ],
  [
    "B signin accepts correct password",
    () => request("/api/auth/signin", { method: "POST", form: { email: emailB, password }, jar: jarB }),
    { status: 302, location: "/consultations" },
  ],
  [
    "B slots omit A's booking",
    () => request("/api/consultations/slots", { jar: jarB }),
    { status: 200, json: (data) => Array.isArray(data.slots) && !data.slots.includes(bookedSlot) },
  ],
  [
    "B cannot take A's slot",
    () =>
      request("/api/consultations", {
        method: "POST",
        form: surveyForm(bookedSlot, `ClientB-${stamp}`),
        jar: jarB,
      }),
    { status: 409 },
  ],
  [
    "B consultations list hides A's dog",
    () => request("/consultations", { jar: jarB }),
    { status: 200, bodyExcludes: dogName },
  ],
  [
    "B consultations list hides the pending dog",
    () => request("/consultations", { jar: jarB }),
    { status: 200, bodyExcludes: `ClientB-${stamp}` },
  ],
  [
    "behaviorist rejects A's booking",
    () =>
      request(`/api/consultations/${bookedId}/decision`, {
        method: "POST",
        form: { decision: "rejected" },
        jar: jarBehaviorist,
      }),
    { status: 302, location: "/dashboard?decided=rejected" },
  ],
  [
    "B books the slot after rejection",
    () =>
      request("/api/consultations", {
        method: "POST",
        form: surveyForm(bookedSlot, `ClientB-${stamp}`),
        jar: jarB,
      }),
    { status: 201 },
  ],
  [
    "B consultations list shows the dog",
    () => request("/consultations", { jar: jarB }),
    { status: 200, bodyIncludes: `ClientB-${stamp}` },
  ],
  [
    "anonymous booking is unauthorized",
    () => request("/api/consultations", { method: "POST", form: surveyForm(bookedSlot), jar: jarAnon }),
    { status: 401 },
  ],
];

let failed = 0;
for (const [name, run, expected] of steps) {
  const actual = await run();
  const ok = stepPassed(actual, expected);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  -> ${actual.status} ${actual.location}`);
  if (!ok) {
    failed++;
    console.log(`      expected ${expected.status} ${expected.location ?? ""}`);
  }
}

console.log(failed ? `\n${failed} step(s) failed` : "\nAll smoke steps passed");
process.exit(failed ? 1 : 0);
