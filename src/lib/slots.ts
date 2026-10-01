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
function warsawDay(instant: Date): number {
  const p = warsawParts(instant.getTime());
  return Date.UTC(p.year, p.month - 1, p.day);
}

function warsawWallTimeToInstant(dayMs: number, hour: number, minute = 0): Date {
  const wallAsUtc = dayMs + hour * 60 * MINUTE_MS + minute * MINUTE_MS;
  // The offset at the wall time read as UTC can differ from the real one near a DST switch; re-read it at the guess.
  const guess = wallAsUtc - warsawOffsetMs(wallAsUtc);
  return new Date(wallAsUtc - warsawOffsetMs(guess));
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
