import type { APIRoute } from "astro";
import { blockDayLocation, readFormString, requireBehavioristApi } from "@/lib/consultation-api";
import { parseCalendarDay } from "@/lib/slots";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const POST: APIRoute = async (context) => {
  const session = requireBehavioristApi(context);
  if (!session.ok) {
    return session.response;
  }

  const form = await context.request.formData();
  const id = readFormString(form, "id");
  const day = readFormString(form, "day");

  if (!UUID_PATTERN.test(id) || parseCalendarDay(day) === null) {
    return context.redirect(blockDayLocation(day, "delete"), 303);
  }

  const { error } = await session.supabase.from("availability_blocks").delete().eq("id", id);
  if (error) {
    return context.redirect(blockDayLocation(day, "delete"), 303);
  }

  return context.redirect(blockDayLocation(day), 303);
};
