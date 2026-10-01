import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/db/database.types";
import { availableSlots, bookingWindow } from "@/lib/slots";

export async function getAvailableSlots(supabase: SupabaseClient<Database>, now: Date): Promise<Date[]> {
  const { from, to } = bookingWindow(now);
  const [blocksResult, takenResult] = await Promise.all([
    supabase
      .from("availability_blocks")
      .select("starts_at, ends_at")
      .lt("starts_at", to.toISOString())
      .gt("ends_at", from.toISOString()),
    supabase.rpc("taken_slot_starts", { p_from: from.toISOString(), p_to: to.toISOString() }),
  ]);

  if (blocksResult.error) {
    throw new Error(`Failed to load availability blocks: ${blocksResult.error.message}`, { cause: blocksResult.error });
  }
  if (takenResult.error) {
    throw new Error(`Failed to load taken slots: ${takenResult.error.message}`, { cause: takenResult.error });
  }

  return availableSlots({ now, blocks: blocksResult.data, taken: takenResult.data });
}
