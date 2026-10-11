export const TIME_ZONE = "Europe/Warsaw";
/** Day numbers as returned by `Date.prototype.getUTCDay` (0 = Sunday). */
export const WORKING_DAYS: readonly number[] = [1, 2, 3, 4, 5];
/** Slot start hours in Warsaw local time. */
export const SLOT_STARTS: readonly number[] = [10, 11, 12, 13, 14, 15, 16, 17];
export const SLOT_MINUTES = 60;
export const BOOKING_HORIZON_DAYS = 28;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export interface TimeRange {
  starts_at: string | Date;
  ends_at: string | Date;
}

export interface SlotContext {
  now: Date;
  blocks: readonly TimeRange[];
  taken: readonly (string | Date)[];
}

const warsawFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function warsawParts(instantMs: number) {
  const parts: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of warsawFormatter.formatToParts(instantMs)) {
    if (part.type !== "literal") {
      parts[part.type] = Number(part.value);
    }
  }
  return {
    year: parts.year ?? 0,
    month: parts.month ?? 0,
    day: parts.day ?? 0,
    hour: parts.hour ?? 0,
    minute: parts.minute ?? 0,
    second: parts.second ?? 0,
  };
}

function warsawOffsetMs(instantMs: number): number {
  const p = warsawParts(instantMs);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/** Calendar date in Warsaw, represented as a UTC midnight timestamp so day arithmetic ignores the runtime zone. */
export function warsawDay(instant: Date): number {
  const p = warsawParts(instant.getTime());
  return Date.UTC(p.year, p.month - 1, p.day);
}

function warsawWallTimeToInstant(dayMs: number, hour: number, minute = 0): Date {
  const wallAsUtc = dayMs + hour * 60 * MINUTE_MS + minute * MINUTE_MS;
  // The offset at the wall time read as UTC can differ from the real one near a DST switch; re-read it at the guess.
  const guess = wallAsUtc - warsawOffsetMs(wallAsUtc);
  return new Date(wallAsUtc - warsawOffsetMs(guess));
}

/** Real `YYYY-MM-DD` day as the same UTC-midnight carrier as `warsawDay`, or `null` when it is not one. */
export function parseCalendarDay(day: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return null;
  }
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  const dayMs = Date.UTC(year, month - 1, date);
  const check = new Date(dayMs);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date) {
    return null;
  }
  return dayMs;
}

function requireCalendarDay(day: string): number {
  const dayMs = parseCalendarDay(day);
  if (dayMs === null) {
    throw new RangeError(`Invalid calendar day: ${day}`);
  }
  return dayMs;
}

/** Instant of a Warsaw wall clock on a `YYYY-MM-DD` day. Same conversion as `availableSlots`. */
export function warsawWallTime(day: string, hour: number, minute = 0): Date {
  return warsawWallTimeToInstant(requireCalendarDay(day), hour, minute);
}

/** 00:00 on that Warsaw date through 00:00 on the next one. The October fallback day lasts 25 hours. */
export function warsawDayBounds(day: string): { starts_at: Date; ends_at: Date } {
  const dayMs = requireCalendarDay(day);
  return {
    starts_at: warsawWallTimeToInstant(dayMs, 0),
    ends_at: warsawWallTimeToInstant(dayMs + DAY_MS, 0),
  };
}

export function bookingWindow(now: Date): { from: Date; to: Date } {
  const today = warsawDay(now);
  return {
    from: warsawWallTimeToInstant(today + DAY_MS, 0),
    to: warsawWallTimeToInstant(today + (BOOKING_HORIZON_DAYS + 1) * DAY_MS, 0),
  };
}

export function availableSlots({ now, blocks, taken }: SlotContext): Date[] {
  const blockRanges = blocks.map((block) => ({
    start: new Date(block.starts_at).getTime(),
    end: new Date(block.ends_at).getTime(),
  }));
  const takenStarts = new Set(taken.map((value) => new Date(value).getTime()));
  const today = warsawDay(now);
  const slots: Date[] = [];

  for (let offset = 1; offset <= BOOKING_HORIZON_DAYS; offset++) {
    const day = today + offset * DAY_MS;
    if (!WORKING_DAYS.includes(new Date(day).getUTCDay())) {
      continue;
    }
    for (const hour of SLOT_STARTS) {
      const slotStart = warsawWallTimeToInstant(day, hour);
      const startMs = slotStart.getTime();
      const endMs = startMs + SLOT_MINUTES * MINUTE_MS;
      const blocked = blockRanges.some((block) => block.start < endMs && block.end > startMs);
      if (!blocked && !takenStarts.has(startMs)) {
        slots.push(slotStart);
      }
    }
  }

  return slots.sort((a, b) => a.getTime() - b.getTime());
}

export function isAvailableSlot(slot: Date, ctx: SlotContext): boolean {
  const slotMs = slot.getTime();
  return availableSlots(ctx).some((candidate) => candidate.getTime() === slotMs);
}
