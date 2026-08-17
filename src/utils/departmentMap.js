/**
 * Keep in sync with cms-backend/src/utils/department-map.js
 * Canonical department names + legacy aliases (CS/CRM → MKT, Production → PD, …).
 */

export const CANONICAL_DEPARTMENTS = [
  "ENG",
  "FG",
  "HR",
  "IQC",
  "LAB",
  "LTS",
  "MA",
  "MKT",
  "PD",
  "PKG",
  "PLAN",
  "PU",
  "QA",
  "QC",
  "RM",
  "SALE",
  "WH",
  "รอเคลียร์",
];

export const DEPARTMENT_LEGACY_MAP = {
  crm: "MKT",
  cs: "MKT",
  "customer service": "MKT",
  customerservice: "MKT",
  en: "ENG",
  eng: "ENG",
  lts: "LTS",
  mkt: "MKT",
  packing: "PKG",
  pack: "PKG",
  pkg: "PKG",
  pd: "PD",
  plan: "PLAN",
  planning: "PLAN",
  production: "PD",
  prod: "PD",
  qa: "QA",
  qc: "QC",
  ตลาด: "MKT",
  "ผลิต qc": "PD",
  ผลิตqc: "PD",
  pdqc: "PD",
  "pd qc": "PD",
  รอเคลียร์: "รอเคลียร์",
  วางแผน: "PLAN",
  customer: "MKT",
  "production qa": "PD",
  "production,qa": "PD",
  "pd,qa": "PD",
  "qa,pd": "PD",
  fg: "FG",
  hr: "HR",
  iqc: "IQC",
  lab: "LAB",
  ma: "MA",
  pu: "PU",
  rm: "RM",
  sale: "SALE",
  sales: "SALE",
  wh: "WH",
  warehouse: "WH",
};

export function normalizeDepartmentKey(value) {
  return String(value || "")
    .trim()
    .replace(/[_\-/|]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function canonicalizeDepartmentName(value) {
  if (value == null) return null;
  const clean = String(value).replace(/\s+/g, " ").trim();
  if (!clean || clean === "-" || clean.toLowerCase() === "null") return null;

  const key = normalizeDepartmentKey(clean);
  const mapped = DEPARTMENT_LEGACY_MAP[key];
  if (mapped) return mapped;

  const hit = CANONICAL_DEPARTMENTS.find(
    (name) => normalizeDepartmentKey(name) === key,
  );
  if (hit) return hit;

  if (/[,/+&]/.test(clean)) {
    const parts = clean
      .split(/[,/+&]/)
      .map((part) => canonicalizeDepartmentName(part))
      .filter(Boolean);
    const unique = [...new Set(parts)];
    const canonicalPart = unique.find((name) =>
      CANONICAL_DEPARTMENTS.some(
        (item) => normalizeDepartmentKey(item) === normalizeDepartmentKey(name),
      ),
    );
    if (canonicalPart) return canonicalPart;
  }

  return clean;
}
