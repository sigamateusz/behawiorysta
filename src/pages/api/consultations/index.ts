import type { APIRoute } from "astro";
import { getAvailableSlots } from "@/lib/availability";
import { jsonError, readFormString, requireClientApi, SLOT_CONFLICT_MESSAGE } from "@/lib/consultation-api";
import { consultationSchema, firstFieldErrors } from "@/lib/consultation-schema";

export const POST: APIRoute = async (context) => {
  const session = requireClientApi(context);
  if (!session.ok) {
    return session.response;
  }

  const form = await context.request.formData();
  const parsed = consultationSchema.safeParse({
    dog_name: readFormString(form, "dog_name"),
    breed: readFormString(form, "breed"),
    age_years: readFormString(form, "age_years"),
    age_months: readFormString(form, "age_months"),
    basic_info: readFormString(form, "basic_info"),
    goals: readFormString(form, "goals"),
    slot_start: readFormString(form, "slot_start"),
  });

  if (!parsed.success) {
    return Response.json({ errors: firstFieldErrors(parsed.error) }, { status: 400 });
  }

  const requestedStart = new Date(parsed.data.slot_start);
  let available: Date[];
  try {
    available = await getAvailableSlots(session.supabase, new Date());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się sprawdzić dostępności";
    return jsonError(500, message);
  }

  const slotOpen = available.some((slot) => slot.getTime() === requestedStart.getTime());
  if (!slotOpen) {
    return jsonError(409, SLOT_CONFLICT_MESSAGE);
  }

  const { data, error } = await session.supabase
    .from("consultations")
    .insert({
      dog_name: parsed.data.dog_name,
      breed: parsed.data.breed,
      age_years: parsed.data.age_years,
      age_months: parsed.data.age_months,
      basic_info: parsed.data.basic_info,
      goals: parsed.data.goals,
      slot_start: parsed.data.slot_start,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return jsonError(409, SLOT_CONFLICT_MESSAGE);
    }
    return jsonError(500, error.message);
  }

  return Response.json({ id: data.id }, { status: 201 });
};
