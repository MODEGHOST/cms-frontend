import dayjs from "dayjs";

export function formatDate(value, pattern = "DD/MM/YYYY") {
  if (!value) return "-";
  const parsed = dayjs(value);
  if (!parsed.isValid()) return String(value);
  const formatPattern = typeof pattern === "string" && pattern ? pattern : "DD/MM/YYYY";
  return parsed.format(formatPattern);
}
