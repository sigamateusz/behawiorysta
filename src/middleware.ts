import { defineMiddleware } from "astro:middleware";
import { dashboardRedirect } from "@/lib/role-routes";
import { classifySession, logAuthOutage, outageResponse } from "@/lib/session-gate";
import { createClient } from "@/lib/supabase";

const PROTECTED_ROUTES = ["/dashboard", "/consultations"];
const CLIENT_ROUTES = ["/consultations"];

function toRole(value: string | undefined): App.Locals["role"] {
  return value === "client" || value === "behaviorist" ? value : null;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createClient(context.request.headers, context.cookies);

  context.locals.user = null;
  context.locals.role = null;

  if (supabase) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    let profileError: { code: string | null } | null = null;
    let role: App.Locals["role"] = null;
    if (user) {
      const { data: profile, error } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (error) {
        profileError = { code: error.code };
      } else {
        role = toRole(profile?.role);
      }
    }

    const session = classifySession({
      authError: authError
        ? { name: authError.name, status: authError.status ?? null, code: authError.code ?? null }
        : null,
      userId: user?.id ?? null,
      profileError,
      role,
    });

    if (session.kind === "outage") {
      logAuthOutage(session, context.url.pathname, user?.id ?? null);
      return outageResponse(context.request.headers.get("accept"));
    }

    context.locals.user = user;
    context.locals.role = session.kind === "ready" ? session.role : null;
  }

  const { pathname } = context.url;

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
    }
  }

  if (context.locals.user && pathname.startsWith("/dashboard")) {
    const destination = dashboardRedirect(context.locals.role);
    if (destination !== null) {
      return context.redirect(destination);
    }
  }

  if (CLIENT_ROUTES.some((route) => pathname.startsWith(route))) {
    if (context.locals.role === "behaviorist") {
      return context.redirect("/dashboard");
    }
    if (context.locals.role !== "client") {
      return context.redirect("/");
    }
  }

  return next();
});
