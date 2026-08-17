/** ฟิลด์ที่อนุญาตเติมจาก ERP เข้า Reject (เติมเฉพาะช่องว่าง) */
export const REJECT_ERP_FIELDS = [
  "pdr_no",
  "sale_order_no",
  "company_name",
  "customer_alias_name",
  "customer_ship_date",
  "production_date",
  "machine_name",
  "flute_name",
  "shift",
  "size",
  "vehicle_plate",
  "weight_per_sheet",
  "price_per_sheet",
  "order_qty",
  "cut_qty",
  "item_code",
  "big_sheet_qty",
  "big_sheet_size",
  "small_sheet_size",
];

/** ฟิลด์ที่อนุญาตเติมจาก ERP เข้า Complaint (เติมเฉพาะช่องว่าง) */
export const COMPLAINT_ERP_FIELDS = [
  "pdr_no",
  "order_no",
  "sale_order_no",
  "company_name",
  "customer_alias_name",
  "delivery_date",
  "production_date",
  "customer_ship_date",
  "sale_cs_staff",
  "product_name",
  "flute_name",
  "paper_m5",
  "paper_m4",
  "paper_m3",
  "paper_m2",
  "paper_m1",
  "demand_qty",
  "plan_no",
  "machine_name",
  "shift",
  "problem_name_en",
  "grade",
  "weight_per_sheet",
  "price_per_sheet",
];

function isEmpty(value) {
  return value == null || value === "";
}

function pickMapped(row, fields) {
  if (!row || typeof row !== "object") return {};
  const out = {};
  for (const key of fields) {
    if (Object.prototype.hasOwnProperty.call(row, key) && !isEmpty(row[key])) {
      out[key] = row[key];
    }
  }
  // demand_qty จาก ERP → order_qty ฝั่ง Reject ถ้ามี
  if (
    fields.includes("order_qty") &&
    isEmpty(out.order_qty) &&
    !isEmpty(row.demand_qty)
  ) {
    out.order_qty = row.demand_qty;
  }
  // Size ในฟอร์ม Reject = Description จาก ERP (API ส่งเป็น product_name / description)
  if (fields.includes("size")) {
    const description = row.description || row.product_name;
    if (!isEmpty(description)) {
      out.size = description;
    } else {
      delete out.size;
    }
  }
  // Reject: ถ้าไม่มี flute จาก ERP — ดึงอักษรท้ายจาก Size (เช่น ... CA125 B → B)
  if (fields.includes("flute_name") && isEmpty(out.flute_name)) {
    const fromSize = parseFluteFromSize(out.size || row.description || row.product_name);
    if (fromSize) out.flute_name = fromSize;
  }
  // ใบ Tag: ชื่อฟิลด์ ERP → คอลัมน์ reject_records (อ่านอย่างเดียว)
  if (fields.includes("cut_qty") && isEmpty(out.cut_qty) && !isEmpty(row.t)) {
    out.cut_qty = row.t;
  }
  if (
    fields.includes("item_code") &&
    isEmpty(out.item_code) &&
    !isEmpty(row.item_no)
  ) {
    out.item_code = row.item_no;
  }
  if (
    fields.includes("big_sheet_qty") &&
    isEmpty(out.big_sheet_qty) &&
    !isEmpty(row.big_sheet)
  ) {
    out.big_sheet_qty = row.big_sheet;
  }
  return out;
}

/** รหัสลอนท้าย Size: A / AB / B / BC / C / E */
function parseFluteFromSize(size) {
  const text = String(size || "").trim();
  if (!text) return null;
  const match = text.match(/\b(AB|BC|A|B|C|E)\s*$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * เติมเฉพาะช่องที่ว่างใน record — ไม่ทับข้อมูล CMS ที่มีอยู่แล้ว
 * ยกเว้น size: ใช้ Description จาก ERP เสมอ (ไม่ใช้ Weight W)
 * ไม่บันทึกลง DB อัตโนมัติ (แค่แสดงใน UI จนกว่าผู้ใช้จะเซฟช่องที่แก้ได้)
 */
export function mergeErpIntoRecord(record, erpRow, fields) {
  if (!record || !erpRow) {
    return { record, filledKeys: [] };
  }
  const mapped = pickMapped(erpRow, fields);
  const next = { ...record };
  const filledKeys = [];
  for (const [key, value] of Object.entries(mapped)) {
    const alwaysFromErp = key === "size";
    if (alwaysFromErp || isEmpty(record[key])) {
      if (alwaysFromErp && record[key] === value) continue;
      next[key] = value;
      filledKeys.push(key);
    }
  }
  // Reject: ถ้ายังไม่มีลอน — ลองดึงจาก Size ที่มีอยู่ (ERP หรือเดิมในฟอร์ม)
  if (
    fields.includes("flute_name") &&
    isEmpty(next.flute_name) &&
    !isEmpty(next.size)
  ) {
    const fromSize = parseFluteFromSize(next.size);
    if (fromSize) {
      next.flute_name = fromSize;
      filledKeys.push("flute_name");
    }
  }
  return { record: next, filledKeys };
}

/** สร้าง object ใส่ฟอร์มจาก ERP — ยังไม่มี id ใน CMS */
export function buildErpDraftRecord(erpRow, kind = "complaint") {
  const fields = kind === "reject" ? REJECT_ERP_FIELDS : COMPLAINT_ERP_FIELDS;
  const { record } = mergeErpIntoRecord({}, erpRow, fields);
  return {
    ...record,
    id: null,
    _fromErp: true,
    workflow_status: kind === "complaint" ? "cs_draft" : undefined,
    source: "erp",
  };
}
