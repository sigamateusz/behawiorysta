import { describe, expect, it } from "vitest";
import { blockSelection, coversWarsawDay, isRangeInside, overlappingSlotHours } from "@/lib/blocks";
import { warsawDayBounds } from "@/lib/slots";

// Sunday 11.10.2026 12:00 in Warsaw (CEST, UTC+2).
const NOW = new Date("2026-10-11T10:00:00.000Z");

function selection(day: string, wholeDay: boolean, hours: readonly number[] = []) {
  return blockSelection({ day, wholeDay, hours }, NOW);
}

describe("blockSelection", () => {
  it("spans a Warsaw day from midnight to the next midnight, including the 25-hour fallback", () => {
    expect(selection("2026-10-12", true)).toEqual({
      ok: true,
      ranges: [
        {
          starts_at: new Date("2026-10-11T22:00:00.000Z"),
          ends_at: new Date("2026-10-12T22:00:00.000Z"),
        },
      ],
    });

    // 25.10.2026 is a Sunday, so selection refuses it; the bounds are still the fallback day.
    expect(warsawDayBounds("2026-10-25")).toEqual({
      starts_at: new Date("2026-10-24T22:00:00.000Z"),
      ends_at: new Date("2026-10-25T23:00:00.000Z"),
    });
  });

  it("keeps 10:00 and 14:00 as two ranges and ignores those hours for a whole day", () => {
    expect(selection("2026-10-12", false, [14, 10])).toEqual({
      ok: true,
      ranges: [
        {
          starts_at: new Date("2026-10-12T08:00:00.000Z"),
          ends_at: new Date("2026-10-12T09:00:00.000Z"),
        },
        {
          starts_at: new Date("2026-10-12T12:00:00.000Z"),
          ends_at: new Date("2026-10-12T13:00:00.000Z"),
        },
      ],
    });

    expect(selection("2026-10-12", true, [18, 10, 14])).toEqual({
      ok: true,
      ranges: [
        {
          starts_at: new Date("2026-10-11T22:00:00.000Z"),
          ends_at: new Date("2026-10-12T22:00:00.000Z"),
        },
      ],
    });
  });

  it("stores 10:00 on both sides of the October clock change", () => {
    expect(selection("2026-10-23", false, [10])).toEqual({
      ok: true,
      ranges: [
        {
          starts_at: new Date("2026-10-23T08:00:00.000Z"),
          ends_at: new Date("2026-10-23T09:00:00.000Z"),
        },
      ],
    });
    expect(selection("2026-10-26", false, [10])).toEqual({
      ok: true,
      ranges: [
        {
          starts_at: new Date("2026-10-26T09:00:00.000Z"),
          ends_at: new Date("2026-10-26T10:00:00.000Z"),
        },
      ],
    });
  });

  it("allows 12 October and 9 November and refuses past, same-day and weekend dates", () => {
    expect(selection("2026-10-12", true).ok).toBe(true);
    expect(selection("2026-11-09", true).ok).toBe(true);
    expect(selection("2026-10-09", true)).toEqual({ ok: false, code: "date" });
    expect(selection("2026-10-11", true)).toEqual({ ok: false, code: "date" });
    expect(selection("2026-10-17", true)).toEqual({ ok: false, code: "date" });
    expect(selection("2026-10-11", false, [])).toEqual({ ok: false, code: "date" });
    expect(selection("2026-02-31", true)).toEqual({ ok: false, code: "date" });
    expect(selection("11.10.2026", true)).toEqual({ ok: false, code: "date" });
  });

  it("rejects an empty selection and an hour outside the grid", () => {
    expect(selection("2026-10-12", false, [])).toEqual({ ok: false, code: "empty" });
    expect(selection("2026-10-12", false, [18])).toEqual({ ok: false, code: "hour" });
  });
});

describe("block coverage", () => {
  const day = "2026-10-12";
  const wholeDay = {
    starts_at: new Date("2026-10-11T22:00:00.000Z"),
    ends_at: new Date("2026-10-12T22:00:00.000Z"),
  };
  const hour10 = {
    starts_at: new Date("2026-10-12T08:00:00.000Z"),
    ends_at: new Date("2026-10-12T09:00:00.000Z"),
  };

  it("treats 10:00 as inside a whole day, which that hour row does not itself cover", () => {
    expect(isRangeInside(hour10, wholeDay)).toBe(true);
    expect(isRangeInside(wholeDay, hour10)).toBe(false);
    expect(coversWarsawDay(wholeDay, day)).toBe(true);
    expect(coversWarsawDay(hour10, day)).toBe(false);
    expect(overlappingSlotHours(day, [wholeDay])).toContain(10);
  });

  it("overlaps 12:30–13:30 onto slots 12 and 13", () => {
    // 12:30–13:30 in Warsaw on 12 October 2026 (CEST, UTC+2).
    expect(
      overlappingSlotHours(day, [
        { starts_at: new Date("2026-10-12T10:30:00.000Z"), ends_at: new Date("2026-10-12T11:30:00.000Z") },
      ]),
    ).toEqual([12, 13]);
  });
});
