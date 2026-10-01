import { defineMiddleware } from "astro:middleware";
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
    } = await supabase.auth.getUser();
    context.locals.user = user ?? null;

    if (user) {
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
      context.locals.role = toRole(profile?.role);
    }
  }

  const { pathname } = context.url;

  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    if (!context.locals.user) {
      return context.redirect("/auth/signin");
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
