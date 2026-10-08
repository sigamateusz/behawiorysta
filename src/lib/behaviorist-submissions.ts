import { SLOT_MINUTES } from "@/lib/slots";

export function visibleSubmissions<
  T extends {
    id: string;
    status: string;
    slot_start: string;
    created_at: string;
  },
>(rows: readonly T[], now: Date): T[] {
  const nowMs = now.getTime();

  return rows
    .filter((row) => {
      const slotMs = Date.parse(row.slot_start);
      const createdMs = Date.parse(row.created_at);
      if (Number.isNaN(slotMs) || Number.isNaN(createdMs)) {
        return false;
      }
      if (row.status === "pending") {
        return true;
      }
      return row.status === "accepted" && slotMs + SLOT_MINUTES * 60_000 > nowMs;
    })
    .sort((left, right) => {
      const bySlot = Date.parse(left.slot_start) - Date.parse(right.slot_start);
      if (bySlot !== 0) {
        return bySlot;
      }
      const byCreated = Date.parse(left.created_at) - Date.parse(right.created_at);
      if (byCreated !== 0) {
        return byCreated;
      }
      return left.id.localeCompare(right.id);
    });
}
