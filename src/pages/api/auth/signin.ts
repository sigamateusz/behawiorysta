import type { APIRoute } from "astro";
import { redirectAfterSignIn } from "@/lib/role-routes";
import { classifySession, logAuthOutage, outageResponse } from "@/lib/session-gate";
import { createClient } from "@/lib/supabase";

export const POST: APIRoute = async (context) => {
  const form = await context.request.formData();
  const email = form.get("email") as string;
  const password = form.get("password") as string;

  const supabase = createClient(context.request.headers, context.cookies);
  if (!supabase) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent("Supabase is not configured")}`);
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return context.redirect(`/auth/signin?error=${encodeURIComponent(error.message)}`);
  }

  const userId = data.user.id;
  let role: "client" | "behaviorist" | null = null;
  let profileFailure: { code: string | null } | null = null;
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      profileFailure = { code: profileError.code };
    } else if (profile?.role === "behaviorist" || profile?.role === "client") {
      role = profile.role;
    }
  }

  const session = classifySession({
    authError: null,
    userId,
    profileError: profileFailure,
    role,
  });

  if (session.kind === "outage") {
    logAuthOutage(session, context.url.pathname, userId);
    return outageResponse(context.request.headers.get("accept"));
  }

  return context.redirect(redirectAfterSignIn(session.kind === "ready" ? session.role : null));
};
