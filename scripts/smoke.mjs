// Smoke test: proves the built app, the Cloudflare adapter, Supabase auth, and the client booking flow still work together.
// Zero dependencies on purpose. Run against a live server: BASE_URL=http://localhost:4321 node scripts/smoke.mjs

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4321";
const stamp = Date.now();
const email = `smoke-${stamp}@example.com`;
const emailA = `smoke-a-${stamp}@example.com`;
const emailB = `smoke-b-${stamp}@example.com`;
const password = "Smoke-Test-Passw0rd!";
const dogName = `Smoke-${stamp}`;
const jar = new Map();
const jarA = new Map();
const jarB = new Map();
const jarAnon = new Map();

let bookedSlot = "";

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

function stepPassed(actual, expected) {
  if (actual.status !== expected.status) return false;
  if (expected.location !== undefined && !actual.location.startsWith(expected.location)) return false;
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
    { status: 302, location: "/" },
  ],
  ["dashboard renders for signed-in user", () => request("/dashboard"), { status: 200 }],
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
    { status: 302, location: "/" },
  ],
  ["A consultation form renders", () => request("/consultations/new", { jar: jarA }), { status: 200 }],
  [
    "A lists available slots",
    async () => {
      const actual = await request("/api/consultations/slots", { jar: jarA });
      try {
        const slots = JSON.parse(actual.body).slots;
        bookedSlot = Array.isArray(slots) && typeof slots[0] === "string" ? slots[0] : "";
      } catch {
        bookedSlot = "";
      }
      return actual;
    },
    { status: 200, json: (data) => Array.isArray(data.slots) && data.slots.length >= 1 },
  ],
  [
    "A incomplete survey is rejected",
    () => request("/api/consultations", { method: "POST", form: { dog_name: "" }, jar: jarA }),
    { status: 400 },
  ],
  [
    "A books the first slot",
    () => request("/api/consultations", { method: "POST", form: surveyForm(bookedSlot), jar: jarA }),
    { status: 201 },
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
    { status: 302, location: "/" },
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
