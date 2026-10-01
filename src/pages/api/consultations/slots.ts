import type { APIRoute } from "astro";
import { getAvailableSlots } from "@/lib/availability";
import { jsonError, requireClientApi } from "@/lib/consultation-api";

export const GET: APIRoute = async (context) => {
  const session = requireClientApi(context);
  if (!session.ok) {
    return session.response;
  }

  try {
    const slots = await getAvailableSlots(session.supabase, new Date());
    return Response.json({ slots: slots.map((slot) => slot.toISOString()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać terminów";
    return jsonError(500, message);
  }
};
