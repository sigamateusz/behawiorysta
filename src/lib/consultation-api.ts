import type { APIContext } from "astro";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { dashboardRedirect } from "@/lib/role-routes";
import { createClient } from "@/lib/supabase";

export const SLOT_CONFLICT_MESSAGE = "Ten termin został właśnie zajęty albo jest niedostępny — wybierz inny.";

export function jsonError(status: number, message: string) {
  return Response.json({ error: message }, { status });
}

export type ClientApiSession = { ok: true; supabase: SupabaseClient<Database> } | { ok: false; response: Response };

export function requireClientApi(context: APIContext): ClientApiSession {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return { ok: false, response: jsonError(500, "Supabase is not configured") };
  }
  if (!context.locals.user) {
    return { ok: false, response: jsonError(401, "Unauthorized") };
  }
  if (context.locals.role !== "client") {
    return { ok: false, response: jsonError(403, "Forbidden") };
  }
  return { ok: true, supabase };
}

export function requireBehavioristForm(context: APIContext): SupabaseClient<Database> | Response {
  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect("/dashboard?decided=error");
  }
  if (!context.locals.user) {
    return context.redirect("/auth/signin");
  }
  const destination = dashboardRedirect(context.locals.role);
  if (destination !== null) {
    return context.redirect(destination);
  }
  return supabase;
}

export function readFormString(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}
