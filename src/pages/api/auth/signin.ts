import type { APIRoute } from "astro";
import { redirectAfterSignIn } from "@/lib/role-routes";
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
  let role: "behaviorist" | null = null;
  if (userId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (!profileError && profile?.role === "behaviorist") {
      role = "behaviorist";
    }
  }

  return context.redirect(redirectAfterSignIn(role));
};
