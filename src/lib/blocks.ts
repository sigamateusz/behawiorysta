import {
  parseCalendarDay,
  SLOT_MINUTES,
  SLOT_STARTS,
  warsawDay,
  warsawDayBounds,
  warsawWallTime,
  type TimeRange,
} from "@/lib/slots";

const MINUTE_MS = 60_000;
const SUNDAY = 0;
const SATURDAY = 6;

function toMs(value: string | Date): number {
  return new Date(value).getTime();
}

export function blockSelection(
  input: { day: string; wholeDay: boolean; hours: readonly number[] },
  now: Date,
): { ok: true; ranges: { starts_at: Date; ends_at: Date }[] } | { ok: false; code: "date" | "empty" | "hour" } {
  const dayMs = parseCalendarDay(input.day);
  if (dayMs === null) {
    return { ok: false, code: "date" };
  }
  const weekday = new Date(dayMs).getUTCDay();
  if (weekday === SUNDAY || weekday === SATURDAY || dayMs <= warsawDay(now)) {
    return { ok: false, code: "date" };
  }
  if (input.wholeDay) {
    const { starts_at, ends_at } = warsawDayBounds(input.day);
    return { ok: true, ranges: [{ starts_at, ends_at }] };
  }
  if (input.hours.length === 0) {
    return { ok: false, code: "empty" };
  }
  if (input.hours.some((hour) => !SLOT_STARTS.includes(hour))) {
    return { ok: false, code: "hour" };
  }

  const chosen = new Set(input.hours);
  const ranges = SLOT_STARTS.filter((hour) => chosen.has(hour)).map((hour) => {
    const starts_at = warsawWallTime(input.day, hour, 0);
    return { starts_at, ends_at: new Date(starts_at.getTime() + SLOT_MINUTES * MINUTE_MS) };
  });
  return { ok: true, ranges };
}

/** Candidate sits entirely inside an existing row: its start is ≥ the row start and its end is ≤ the row end. */
export function isRangeInside(candidate: TimeRange, existing: TimeRange): boolean {
  return toMs(candidate.starts_at) >= toMs(existing.starts_at) && toMs(candidate.ends_at) <= toMs(existing.ends_at);
}

/** Row covers the Warsaw day when that day's [00:00, next 00:00] sits inside the row. */
export function coversWarsawDay(row: TimeRange, day: string): boolean {
  const bounds = warsawDayBounds(day);
  return toMs(row.starts_at) <= bounds.starts_at.getTime() && toMs(row.ends_at) >= bounds.ends_at.getTime();
}

/** `SLOT_STARTS` hours whose 60 minutes overlap a range, using `start < slotEnd && end > slotStart`. */
export function overlappingSlotHours(day: string, ranges: readonly TimeRange[]): number[] {
  const blocks = ranges.map((range) => ({ start: toMs(range.starts_at), end: toMs(range.ends_at) }));
  return SLOT_STARTS.filter((hour) => {
    const slotStart = warsawWallTime(day, hour, 0).getTime();
    const slotEnd = slotStart + SLOT_MINUTES * MINUTE_MS;
    return blocks.some((block) => block.start < slotEnd && block.end > slotStart);
  });
}
