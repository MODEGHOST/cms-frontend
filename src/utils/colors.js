/** Distinct categorical colors for stacked machine bars — easy to tell apart */
export const STACK_FALLBACK = [
  "#2563eb",
  "#f97316",
  "#10b981",
  "#a855f7",
  "#64748b",
  "#06b6d4",
  "#e11d48",
];

export const MACHINE_COLOR_MAP = {
  BHS: "#f97316", // orange
  YUELI: "#2563eb", // blue
  ISOWA: "#10b981", // green
  CT: "#a855f7", // purple
};

/** Stable color for a machine (or any series) name, falling back to a hashed palette slot. */
export function colorForKey(key, fallbackIndex = 0) {
  const name = String(key || "").trim();
  if (!name || name === "count") return STACK_FALLBACK[fallbackIndex % STACK_FALLBACK.length];
  if (name.includes("ไม่ระบุ")) return "#64748b";
  const upper = name.toUpperCase();
  if (MACHINE_COLOR_MAP[upper]) return MACHINE_COLOR_MAP[upper];
  const hit = Object.entries(MACHINE_COLOR_MAP).find(([known]) => upper.includes(known));
  if (hit) return hit[1];
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return STACK_FALLBACK[hash % STACK_FALLBACK.length];
}
