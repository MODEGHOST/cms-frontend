import dayjs from "dayjs";

export const DISPLAY_DATE = "DD/MM/YYYY";
export const DISPLAY_DATETIME = "DD/MM/YYYY HH:mm";

const TH_WEEKDAYS = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

export function formatDate(value, pattern = DISPLAY_DATE) {
  if (!value) return "-";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);
  const formatPattern = typeof pattern === "string" && pattern ? pattern : DISPLAY_DATE;
  return parsed.format(formatPattern);
}

export function formatDateRange(from, to, pattern = DISPLAY_DATE) {
  if (!from && !to) return "-";
  if (!to || from === to) return formatDate(from, pattern);
  return `${formatDate(from, pattern)} – ${formatDate(to, pattern)}`;
}

/** Calendar days from `from` to `to` (same day = 0). Invalid or missing dates → null. */
export function calendarDayDiff(from, to) {
  if (!from || !to) return null;
  const start = dayjs(from).startOf("day");
  const end = dayjs(to).startOf("day");
  if (!start.isValid() || !end.isValid()) return null;
  const days = end.diff(start, "day");
  return days >= 0 ? days : null;
}

export function formatTodayWithWeekday(value = new Date()) {
  const parsed = dayjs(value);
  if (!parsed.isValid()) return "-";
  return `วัน${TH_WEEKDAYS[parsed.day()]} ${parsed.format(DISPLAY_DATE)}`;
}
