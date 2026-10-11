import type { APIRoute } from "astro";
import { blockSelection, isRangeInside } from "@/lib/blocks";
import { blockDayLocation, readFormString, requireBehavioristApi } from "@/lib/consultation-api";
import { warsawDayBounds } from "@/lib/slots";

export const POST: APIRoute = async (context) => {
  const session = requireBehavioristApi(context);
  if (!session.ok) {
    return session.response;
  }

  const form = await context.request.formData();
  const day = readFormString(form, "day");
  const wholeDay = form.getAll("whole_day").some((value) => value === "1");
  const hours = form.getAll("hour").map((value) => (typeof value === "string" ? Number(value) : Number.NaN));

  const selection = blockSelection({ day, wholeDay, hours }, new Date());
  if (!selection.ok) {
    return context.redirect(blockDayLocation(day, selection.code), 303);
  }

  const bounds = warsawDayBounds(day);
  const { data: existing, error: readError } = await session.supabase
    .from("availability_blocks")
    .select("starts_at, ends_at")
    .lt("starts_at", bounds.ends_at.toISOString())
    .gt("ends_at", bounds.starts_at.toISOString());

  if (readError) {
    return context.redirect(blockDayLocation(day, "save"), 303);
  }

  const duplicate = selection.ranges.some((candidate) => existing.some((row) => isRangeInside(candidate, row)));
  if (duplicate) {
    return context.redirect(blockDayLocation(day, "duplicate"), 303);
  }

  const { error: insertError } = await session.supabase.from("availability_blocks").insert(
    selection.ranges.map((range) => ({
      starts_at: range.starts_at.toISOString(),
      ends_at: range.ends_at.toISOString(),
      note: null,
    })),
  );

  if (insertError) {
    return context.redirect(blockDayLocation(day, "save"), 303);
  }

  return context.redirect(blockDayLocation(day), 303);
};
