import dayjs from "dayjs";

export function formatDate(value, pattern = "DD/MM/YYYY") {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(pattern) : String(value);
}
