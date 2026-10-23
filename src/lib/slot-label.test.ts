import { describe, expect, it } from "vitest";
import { formatSlotLabel, warsawDayKey, warsawHourMinute } from "@/lib/slot-label";

const CLOCK_CHANGE_LABELS = [
  { instant: "2026-10-23T08:00:00.000Z", hour: "10:00", day: "2026-10-23" },
  { instant: "2026-10-26T09:00:00.000Z", hour: "10:00", day: "2026-10-26" },
  { instant: "2026-10-23T15:00:00.000Z", hour: "17:00", day: "2026-10-23" },
  { instant: "2026-10-26T16:00:00.000Z", hour: "17:00", day: "2026-10-26" },
] as const;

describe("Warsaw labels across the October clock change", () => {
  it("shows 10:00 and 17:00 from independent UTC literals", () => {
    for (const row of CLOCK_CHANGE_LABELS) {
      expect(warsawHourMinute(row.instant)).toBe(row.hour);
      expect(formatSlotLabel(row.instant).endsWith(`· ${row.hour}`)).toBe(true);
      expect(warsawDayKey(row.instant)).toBe(row.day);
    }
  });
});
