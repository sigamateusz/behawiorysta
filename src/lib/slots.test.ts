import { describe, expect, it } from "vitest";
import { availableSlots, bookingWindow, isAvailableSlot, type SlotContext } from "@/lib/slots";

const warsawLabel = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Warsaw",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function iso(dates: Date[]) {
  return dates.map((date) => date.toISOString());
}

function context(now: string, overrides: Partial<SlotContext> = {}): SlotContext {
  return { now: new Date(now), blocks: [], taken: [], ...overrides };
}

// Monday 2026-10-05 23:30 in Warsaw (CEST, UTC+2).
const MONDAY_LATE = "2026-10-05T21:30:00Z";

describe("runtime", () => {
  it("runs outside the Warsaw zone", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("America/New_York");
  });
});

describe("availableSlots", () => {
  it("converts Warsaw wall time to UTC across the October DST switch", () => {
    const slots = iso(availableSlots(context("2026-10-22T10:00:00Z")));
    expect(slots).toContain("2026-10-23T08:00:00.000Z");
    expect(slots).toContain("2026-10-23T15:00:00.000Z");
    expect(slots).toContain("2026-10-26T09:00:00.000Z");
    expect(slots).toContain("2026-10-26T16:00:00.000Z");
    expect(slots).not.toContain("2026-10-26T08:00:00.000Z");
  });

  it("starts tomorrow in Warsaw and ends on day +28 inclusive", () => {
    const slots = availableSlots(context(MONDAY_LATE));
    expect(slots[0]?.toISOString()).toBe("2026-10-06T08:00:00.000Z");
    expect(slots.at(-1)?.toISOString()).toBe("2026-11-02T16:00:00.000Z");
    expect(slots).toHaveLength(20 * 8);
  });

  it("uses the Warsaw date when it differs from the UTC date", () => {
    // 2026-10-06 00:30 in Warsaw, still 2026-10-05 in UTC.
    const slots = availableSlots(context("2026-10-05T22:30:00Z"));
    expect(slots[0]?.toISOString()).toBe("2026-10-07T08:00:00.000Z");
    expect(slots.at(-1)?.toISOString()).toBe("2026-11-03T16:00:00.000Z");
  });

  it("skips weekends and offers only 10:00–17:00 starts", () => {
    const labels = availableSlots(context(MONDAY_LATE)).map((slot) => warsawLabel.format(slot));
    expect(labels.some((label) => label.startsWith("Sat") || label.startsWith("Sun"))).toBe(false);
    const hours = new Set(labels.map((label) => label.slice(-5)));
    expect([...hours].sort()).toEqual(["10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("returns slots sorted ascending", () => {
    const times = availableSlots(context(MONDAY_LATE)).map((slot) => slot.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("removes all 8 slots of a fully blocked day", () => {
    const all = iso(availableSlots(context(MONDAY_LATE)));
    const slots = iso(
      availableSlots(
        context(MONDAY_LATE, {
          blocks: [{ starts_at: "2026-10-06T22:00:00+00:00", ends_at: "2026-10-07T22:00:00+00:00" }],
        }),
      ),
    );
    expect(all.length - slots.length).toBe(8);
    expect(slots.some((slot) => slot.startsWith("2026-10-07"))).toBe(false);
  });

  it("removes both slots overlapped by a 12:30–13:30 block", () => {
    const all = iso(availableSlots(context(MONDAY_LATE)));
    const slots = iso(
      availableSlots(
        context(MONDAY_LATE, {
          blocks: [{ starts_at: new Date("2026-10-08T10:30:00Z"), ends_at: new Date("2026-10-08T11:30:00Z") }],
        }),
      ),
    );
    expect(all.filter((slot) => !slots.includes(slot))).toEqual([
      "2026-10-08T10:00:00.000Z",
      "2026-10-08T11:00:00.000Z",
    ]);
  });

  it("keeps slots that only touch an 11:00–12:00 block", () => {
    const all = iso(availableSlots(context(MONDAY_LATE)));
    const slots = iso(
      availableSlots(
        context(MONDAY_LATE, {
          blocks: [{ starts_at: "2026-10-09T09:00:00Z", ends_at: "2026-10-09T10:00:00Z" }],
        }),
      ),
    );
    expect(all.filter((slot) => !slots.includes(slot))).toEqual(["2026-10-09T09:00:00.000Z"]);
    expect(slots).toContain("2026-10-09T08:00:00.000Z");
    expect(slots).toContain("2026-10-09T10:00:00.000Z");
  });

  it("removes taken slot starts", () => {
    const slots = iso(availableSlots(context(MONDAY_LATE, { taken: ["2026-10-06T08:00:00+00:00"] })));
    expect(slots).not.toContain("2026-10-06T08:00:00.000Z");
    expect(slots[0]).toBe("2026-10-06T09:00:00.000Z");
  });
});

describe("bookingWindow", () => {
  it("spans tomorrow 00:00 to day +29 00:00 in Warsaw", () => {
    const { from, to } = bookingWindow(new Date(MONDAY_LATE));
    expect(from.toISOString()).toBe("2026-10-05T22:00:00.000Z");
    expect(to.toISOString()).toBe("2026-11-02T23:00:00.000Z");
  });

  it("uses the summer offset on the DST switch day", () => {
    const { from } = bookingWindow(new Date("2026-10-24T10:00:00Z"));
    expect(from.toISOString()).toBe("2026-10-24T22:00:00.000Z");
  });

  it("contains every available slot", () => {
    const ctx = context(MONDAY_LATE);
    const { from, to } = bookingWindow(ctx.now);
    for (const slot of availableSlots(ctx)) {
      expect(slot.getTime()).toBeGreaterThanOrEqual(from.getTime());
      expect(slot.getTime()).toBeLessThan(to.getTime());
    }
  });
});

describe("isAvailableSlot", () => {
  const ctx = context(MONDAY_LATE, { taken: [new Date("2026-10-06T08:00:00Z")] });

  it("accepts an exact available start", () => {
    expect(isAvailableSlot(new Date("2026-10-06T09:00:00Z"), ctx)).toBe(true);
  });

  it("rejects taken, off-grid, out-of-window and weekend starts", () => {
    expect(isAvailableSlot(new Date("2026-10-06T08:00:00Z"), ctx)).toBe(false);
    expect(isAvailableSlot(new Date("2026-10-06T09:30:00Z"), ctx)).toBe(false);
    expect(isAvailableSlot(new Date("2026-10-06T16:00:00Z"), ctx)).toBe(false);
    expect(isAvailableSlot(new Date("2026-10-05T08:00:00Z"), ctx)).toBe(false);
    expect(isAvailableSlot(new Date("2026-11-03T09:00:00Z"), ctx)).toBe(false);
    expect(isAvailableSlot(new Date("2026-10-10T08:00:00Z"), ctx)).toBe(false);
  });
});
