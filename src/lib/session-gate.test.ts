import { describe, expect, it } from "vitest";
import { classifySession, type SessionClass } from "@/lib/session-gate";

const signedOut = {
  authError: null,
  userId: null,
  profileError: null,
  role: null,
} as const;

function classify(overrides: Partial<Parameters<typeof classifySession>[0]>): SessionClass {
  return classifySession({ ...signedOut, ...overrides });
}

describe("classifySession", () => {
  it("treats a missing session as anonymous", () => {
    expect(
      classify({
        authError: { name: "AuthSessionMissingError", status: 400, code: "session_not_found" },
      }),
    ).toEqual({ kind: "anonymous" });
  });

  it("treats a retryable auth failure with status 0 as an outage", () => {
    expect(
      classify({
        authError: { name: "AuthRetryableFetchError", status: 0, code: "unexpected_failure" },
      }),
    ).toEqual({
      kind: "outage",
      name: "AuthRetryableFetchError",
      status: 0,
      code: "unexpected_failure",
    });
  });

  it("treats a retryable auth failure with status 503 as an outage", () => {
    expect(
      classify({
        authError: { name: "AuthRetryableFetchError", status: 503, code: "unexpected_failure" },
      }),
    ).toEqual({
      kind: "outage",
      name: "AuthRetryableFetchError",
      status: 503,
      code: "unexpected_failure",
    });
  });

  it("treats a non-retryable auth failure with status 500 as an outage", () => {
    expect(
      classify({
        authError: { name: "AuthApiError", status: 500, code: "unexpected_failure" },
        userId: "user-1",
      }),
    ).toEqual({
      kind: "outage",
      name: "AuthApiError",
      status: 500,
      code: "unexpected_failure",
    });
  });

  it("treats a non-retryable auth failure with status 0 as an outage", () => {
    expect(
      classify({
        authError: { name: "AuthApiError", status: 0, code: null },
      }),
    ).toEqual({
      kind: "outage",
      name: "AuthApiError",
      status: 0,
      code: null,
    });
  });

  it("treats another auth error with status 401 and no user as anonymous", () => {
    expect(
      classify({
        authError: { name: "AuthApiError", status: 401, code: "invalid_jwt" },
      }),
    ).toEqual({ kind: "anonymous" });
  });

  it("treats a profile error as an outage and keeps the PostgREST code", () => {
    expect(
      classify({
        userId: "user-1",
        profileError: { code: "PGRST000" },
        role: "client",
      }),
    ).toEqual({
      kind: "outage",
      name: "profile",
      status: null,
      code: "PGRST000",
    });
  });

  it("treats a user without a profile row as a missing role", () => {
    expect(
      classify({
        userId: "user-1",
        profileError: null,
        role: null,
      }),
    ).toEqual({ kind: "missing-role" });
  });

  it("treats a client role as ready", () => {
    expect(
      classify({
        userId: "user-1",
        role: "client",
      }),
    ).toEqual({ kind: "ready", role: "client" });
  });

  it("treats a behaviorist role as ready", () => {
    expect(
      classify({
        userId: "user-1",
        role: "behaviorist",
      }),
    ).toEqual({ kind: "ready", role: "behaviorist" });
  });
});
