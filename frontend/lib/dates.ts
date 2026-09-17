/**
 * Plain-date helpers. These operate on `YYYY-MM-DD` strings rather than `Date`,
 * because every date in this product is a calendar day in the *user's*
 * timezone — parsing one into a `Date` on the server would silently reinterpret
 * it in the server's zone and shift the day.
 */

export function shiftDay(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

export function formatDay(iso: string, options: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = iso.split("-").map(Number);
  // UTC in, UTC out: the string already *is* the user's local day.
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    ...options,
    timeZone: "UTC",
  });
}

export function isValidDay(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** `YYYY-MM` arithmetic, for the month planner's previous / next. */
export function shiftMonth(month: string, months: number): string {
  const [year, index] = month.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, index - 1 + months, 1));
  return shifted.toISOString().slice(0, 7);
}

export function formatMonth(month: string, options: Intl.DateTimeFormatOptions): string {
  return formatDay(`${month}-01`, options);
}

export function isValidMonth(value: string | undefined): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

/** The `YYYY-MM` a plain day belongs to. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/**
 * Formats a local wall-clock stamp (`YYYY-MM-DDTHH:mm`) as the reminder screens
 * show it. Deliberately string-based: the value is already in the account's
 * timezone, and parsing it into a `Date` would reinterpret it in the browser's.
 */
export function formatLocalStamp(stamp: string): string {
  const [day, time = "00:00"] = stamp.split("T");
  return `${formatDay(day, { weekday: "short", month: "short", day: "numeric" })} · ${time.slice(0, 5)}`;
}

/** ISO-8601 day numbers in the order a week beginning on `weekStartsOn` reads. */
export function weekdayOrder(weekStartsOn: number): number[] {
  return Array.from({ length: 7 }, (_, index) => ((weekStartsOn - 1 + index) % 7) + 1);
}
