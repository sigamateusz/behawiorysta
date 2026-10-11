import type { APIRoute } from "astro";
import { readFormString, requireBehavioristForm } from "@/lib/consultation-api";
import { parseDecision } from "@/lib/consultation-decision";

export const POST: APIRoute = async (context) => {
  const supabase = requireBehavioristForm(context);
  if (supabase instanceof Response) {
    return supabase;
  }

  const id = context.params.id;
  if (!id) {
    return context.redirect("/dashboard?decided=unavailable");
  }

  const form = await context.request.formData();
  const decision = parseDecision(readFormString(form, "decision"));
  if (decision === null) {
    return context.redirect("/dashboard?decided=unavailable");
  }

  const { data, error } = await supabase
    .from("consultations")
    .update({ status: decision })
    .eq("id", id)
    .eq("status", "pending")
    .select("id");

  if (error) {
    return context.redirect("/dashboard?decided=error");
  }

  const updatedId = data.find((row) => row.id === id)?.id;
  if (updatedId !== id) {
    return context.redirect("/dashboard?decided=unavailable");
  }

  return context.redirect(`/dashboard?decided=${decision}`);
};
