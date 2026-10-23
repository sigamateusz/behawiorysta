const TIME_ZONE = "Europe/Warsaw";

function partValue(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function formatSlotLabel(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const weekday = partValue(parts, "weekday").replace(/\.$/, "");
  const day = partValue(parts, "day");
  const month = partValue(parts, "month");
  const hour = partValue(parts, "hour");
  const minute = partValue(parts, "minute");
  return `${weekday} ${day} ${month} · ${hour}:${minute}`;
}

export function warsawDayKey(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function warsawHourMinute(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  const parts = new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = (parts.find((part) => part.type === "hour")?.value ?? "").replace(/\D/g, "");
  const minute = (parts.find((part) => part.type === "minute")?.value ?? "").replace(/\D/g, "");
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export function warsawDayHeading(instant: Date | string): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;
  return new Intl.DateTimeFormat("pl-PL", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}
