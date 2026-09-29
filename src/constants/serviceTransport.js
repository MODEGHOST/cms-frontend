export const SERVICE_SCOPE_INTERNAL = "ภายใน";
export const SERVICE_SCOPE_EXTERNAL = "ภายนอก";

export const SERVICE_SCOPE_OPTIONS = [
  { value: SERVICE_SCOPE_INTERNAL, label: "ร้องเรียนภายใน" },
  { value: SERVICE_SCOPE_EXTERNAL, label: "ร้องเรียนภายนอก" },
];

export const CUSTOMER_GROUP_OPTIONS = [
  { value: "GOLD", label: "GOLD" },
  { value: "Standard", label: "Standard" },
  { value: "VIP", label: "VIP" },
  { value: "Other", label: "Other" },
  { value: "Super Vip", label: "Super Vip" },
  { value: "-", label: "-" },
];

export const ISSUE_TYPE_OPTIONS = [
  { value: "Men", label: "Men" },
  { value: "Method", label: "Method" },
];

export const SUP_CAR_OPTIONS = [
  { value: "LTS", label: "LTS" },
  { value: "ดาวไสวพิเศษ", label: "ดาวไสวพิเศษ" },
  { value: "ปิยะนันท์", label: "ปิยะนันท์" },
  { value: "อรุณ", label: "อรุณ" },
  { value: "ชัยวิวัฒน์", label: "ชัยวิวัฒน์" },
];

export const DEFAULT_CHANNEL = "Line";
export const DEFAULT_AGENCY = "ลูกค้า";

export function normalizeServiceScope(value) {
  const text = String(value || "").trim();
  if (text === SERVICE_SCOPE_INTERNAL || text === SERVICE_SCOPE_EXTERNAL) return text;
  return null;
}

export function serviceScopeLabel(scope) {
  const normalized = normalizeServiceScope(scope);
  if (normalized === SERVICE_SCOPE_INTERNAL) return "ร้องเรียนภายใน";
  if (normalized === SERVICE_SCOPE_EXTERNAL) return "ร้องเรียนภายนอก";
  return "บริการ/ขนส่ง";
}

export function serviceTransportListPath(scope) {
  const normalized = normalizeServiceScope(scope);
  return normalized
    ? `/service-transport?scope=${encodeURIComponent(normalized)}`
    : "/service-transport";
}

export function serviceTransportFormPath({ scope, id } = {}) {
  const params = new URLSearchParams();
  const normalized = normalizeServiceScope(scope);
  if (normalized) params.set("scope", normalized);
  if (id != null && String(id).trim() !== "") params.set("id", String(id));
  const query = params.toString();
  return query ? `/service-transport-form?${query}` : "/service-transport-form";
}

export function serviceTransportNavKey(pathname) {
  return pathname;
}
