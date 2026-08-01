/** Categorical palette ordered so neighbouring slots stay far apart on the hue wheel. */
export const SERIES_PALETTE = [
  "#2563eb", // blue
  "#ef4444", // red
  "#16a34a", // green
  "#f59e0b", // amber
  "#7c3aed", // violet
  "#06b6d4", // cyan
  "#db2777", // pink
  "#84cc16", // lime
  "#ea580c", // orange
  "#0f766e", // teal
  "#a16207", // bronze
  "#475569", // slate
  "#4f46e5", // indigo
  "#f472b6", // light pink
  "#0ea5e9", // sky
  "#78350f", // brown
];

/** Kept for backwards compatibility with older imports. */
export const STACK_FALLBACK = SERIES_PALETTE;

export const MACHINE_COLOR_MAP = {
  BHS: "#ea580c", // orange
  YUELI: "#2563eb", // blue
  ISOWA: "#16a34a", // green
  CT: "#7c3aed", // violet
};

/** Fixed colors for departments so the same team keeps its color across charts. */
export const DEPARTMENT_COLOR_MAP = {
  PD: "#2563eb", // blue
  QA: "#16a34a", // green
  QC: "#f59e0b", // amber
  LTS: "#475569", // slate
  PACKING: "#db2777", // pink
  EN: "#06b6d4", // cyan
  MKT: "#ea580c", // orange
  SALE: "#84cc16", // lime
  PU: "#a16207", // bronze
  IT: "#0f766e", // teal
  HR: "#f472b6", // light pink
  WH: "#78350f", // brown
};

const NEUTRAL = "#94a3b8";

function tokenize(name) {
  return name
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
}

/** Exact color reserved for a known series name, or null when it has no fixed color. */
export function namedColor(key) {
  const name = String(key ?? "").trim();
  if (!name) return null;
  if (name.includes("ไม่ระบุ") || name.includes("รอเคลียร์")) return NEUTRAL;
  const upper = name.toUpperCase();
  if (DEPARTMENT_COLOR_MAP[upper]) return DEPARTMENT_COLOR_MAP[upper];
  if (MACHINE_COLOR_MAP[upper]) return MACHINE_COLOR_MAP[upper];
  const tokens = tokenize(name);
  for (const token of tokens) {
    if (DEPARTMENT_COLOR_MAP[token]) return DEPARTMENT_COLOR_MAP[token];
    if (MACHINE_COLOR_MAP[token]) return MACHINE_COLOR_MAP[token];
  }
  return null;
}

/** Golden-angle hues for the rare case a chart has more series than the palette. */
function overflowColor(index) {
  const hue = Math.round((index * 137.508) % 360);
  const lightness = index % 2 === 0 ? 45 : 62;
  return `hsl(${hue}, 68%, ${lightness}%)`;
}

/**
 * Assign a unique color to every series in one chart.
 * Named series keep their fixed color; the rest take unused palette slots.
 */
export function colorsForKeys(keys = []) {
  const names = [...new Set(keys.map((key) => String(key ?? "").trim()).filter(Boolean))];
  const assigned = {};
  const used = new Set();

  names.forEach((name) => {
    const fixed = namedColor(name);
    if (fixed && !used.has(fixed)) {
      assigned[name] = fixed;
      used.add(fixed);
    }
  });

  let cursor = 0;
  let overflow = 0;
  names.forEach((name) => {
    if (assigned[name]) return;
    while (cursor < SERIES_PALETTE.length && used.has(SERIES_PALETTE[cursor])) cursor += 1;
    const color = cursor < SERIES_PALETTE.length ? SERIES_PALETTE[cursor] : overflowColor(overflow++);
    assigned[name] = color;
    used.add(color);
    cursor += 1;
  });

  return assigned;
}

/** Stable color for a single series, falling back to its slot in the palette. */
export function colorForKey(key, fallbackIndex = 0) {
  const name = String(key ?? "").trim();
  if (!name || name === "count") return SERIES_PALETTE[fallbackIndex % SERIES_PALETTE.length];
  return namedColor(name) || SERIES_PALETTE[fallbackIndex % SERIES_PALETTE.length];
}
