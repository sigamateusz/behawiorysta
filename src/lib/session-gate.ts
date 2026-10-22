export type SessionRole = "client" | "behaviorist";

export interface AuthErrorInput {
  name: string;
  status?: number | null;
  code?: string | null;
}

export interface ProfileErrorInput {
  code?: string | null;
}

export type SessionClass =
  | { kind: "anonymous" }
  | { kind: "missing-role" }
  | { kind: "ready"; role: SessionRole }
  | { kind: "outage"; name: string; status: number | null; code: string | null };

interface ClassifySessionInput {
  authError: AuthErrorInput | null;
  userId: string | null;
  profileError: ProfileErrorInput | null;
  role: SessionRole | null;
}

function isAuthOutage(error: AuthErrorInput): boolean {
  if (error.name === "AuthRetryableFetchError") {
    return true;
  }
  const status = error.status ?? null;
  return status === 0 || (status !== null && status >= 500);
}

export function classifySession(input: ClassifySessionInput): SessionClass {
  const { authError, userId, profileError, role } = input;

  if (authError && isAuthOutage(authError)) {
    return {
      kind: "outage",
      name: authError.name,
      status: authError.status ?? null,
      code: authError.code ?? null,
    };
  }

  if (!userId) {
    return { kind: "anonymous" };
  }

  if (profileError) {
    return {
      kind: "outage",
      name: "profile",
      status: null,
      code: profileError.code ?? null,
    };
  }

  if (role === "client" || role === "behaviorist") {
    return { kind: "ready", role };
  }

  return { kind: "missing-role" };
}

export const OUTAGE_MESSAGE = "Usługa jest chwilowo niedostępna. Spróbuj ponownie.";

export function outageResponse(accept: string | null): Response {
  if (accept?.toLowerCase().includes("text/html")) {
    const body = `<!DOCTYPE html><html lang="pl"><head><meta charset="utf-8"><title>Usługa niedostępna</title></head><body><p>${OUTAGE_MESSAGE}</p></body></html>`;
    return new Response(body, {
      status: 503,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  return new Response(JSON.stringify({ error: OUTAGE_MESSAGE }), {
    status: 503,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function logAuthOutage(
  outage: Extract<SessionClass, { kind: "outage" }>,
  pathname: string,
  userId: string | null,
): void {
  // eslint-disable-next-line no-console
  console.error("auth outage", {
    name: outage.name,
    status: outage.status,
    code: outage.code,
    pathname,
    userId,
  });
}
