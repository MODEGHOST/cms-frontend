export function money(value) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function qty(value, digits = 0) {
  return Number(value || 0).toLocaleString("th-TH", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function pct(value, digits = 2) {
  return `${Number(value || 0).toFixed(digits)}%`;
}
