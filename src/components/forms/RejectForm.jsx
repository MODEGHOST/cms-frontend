import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Typography,
} from "antd";
import { CloseOutlined, EditOutlined, RollbackOutlined, SaveOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "../../utils/datetime";
import { useSession } from "../../hooks/useSession";
import { rejectApi } from "../../services/api";
import { canUpdateRejects } from "../../utils/authz";
import { parseShipQty } from "../../utils/parseShipQty";
import {
  ensureProblemOptions,
  problemNamesOf,
  problemSaveFields,
} from "../../utils/problems";
import { ProblemChips, ProblemFormItem } from "./ProblemField";
import { RejectPdfDocuments } from "./RejectPdfDocuments";

/** Fields that QC department must fill (Excel column mapping). */
export const QC_REQUIRED_FIELDS = new Set([
  "doc_notify_date",
  "reject_received_date",
  "invoice_no",
  "department_name",
  "problem_name",
  "cause",
  "job_type",
  "actual_ship_qty",
  "claim_sheet_qty",
  "sort_claim_sup_qty",
  "sort_weight_kg",
  "return_to_customer_qty",
  "return_amount",
  "return_kg",
  "destroy_bl_qty",
  "destroy_bl_weight",
  "destroy_bl_amount",
  "remark",
]);

const SECTIONS = [
  {
    title: "ข้อมูลเอกสาร ลูกค้า และวันที่",
    layout: "five",
    fields: [
      ["pdr_no", "เลข PDR"],
      ["invoice_no", "Invoice"],
      ["sale_order_no", "Sale Order"],
      ["company_name", "ชื่อเต็มลูกค้า"],
      ["customer_alias_name", "ชื่อลูกค้า"],
      ["department_name", "หน่วยงานที่รับผิดชอบ", "select"],
      ["doc_notify_date", "วันที่แจ้งเอกสาร", "date"],
      ["reject_received_date", "รับ Reject", "date"],
      ["customer_ship_date", "วันที่ส่งลูกค้า", "date"],
      ["production_date", "วันที่ผลิต", "date"],
      // repair_date ซ่อนจาก UI — ยังเก็บใน DB / import ตามเดิม
    ],
  },
  {
    title: "ข้อมูลงานผลิต",
    layout: "fiveThenThree",
    fields: [
      ["machine_name", "เครื่อง"],
      ["flute_name", "ลอน"],
      ["shift", "กะ"],
      ["job_type", "ลักษณะงาน", "select"],
      ["size", "Size"],
      ["order_qty", "Order", "number"],
      ["problem_name", "ปัญหา", "select"],
      ["cause", "สาเหตุ", "textarea"],
      ["vehicle_plate", "ทะเบียน"],
    ],
  },
  {
    title: "ข้อมูลการเคลม",
    layout: "three",
    fields: [
      ["actual_ship_qty", "ยอดส่งจริง", "shipQty"],
      ["claim_sheet_qty", "ลูกค้าเคลมจำนวน (แผ่นเล็ก)", "number"],
      ["weight_per_sheet", "น้ำหนัก/แผ่น (แผ่นเล็ก)", "decimal2"],
      ["claim_weight_kg", "รวมน้ำหนักเคลม (KG)/Order", "decimal2"],
      ["price_per_sheet", "ราคา/แผ่นเล็ก", "decimal2"],
      ["claim_amount", "จำนวนเงิน", "decimal2"],
    ],
  },
  {
    title: "ข้อมูลหลังการเคลม",
    fields: [
      ["sort_claim_sup_qty", "คัดเคลม SUP", "number"],
      ["sort_weight_kg", "น้ำหนัก KG", "decimal2"],
      ["return_to_customer_qty", "คัดส่งคืนลูกค้า", "number"],
      ["return_amount", "จำนวนเงินที่ส่งคืนลูกค้า", "decimal2"],
      ["return_kg", "จำนวน KG", "decimal2"],
      ["destroy_bl_qty", "จำนวนแผ่นทำลาย BL", "number"],
      ["destroy_bl_weight", "น้ำหนักทำลาย BL", "decimal2"],
      ["destroy_bl_amount", "จำนวนเงินทำลาย BL", "decimal2"],
      ["remark", "หมายเหตุ", "textarea"],
    ],
  },
];

function displayValue(value, type) {
  if (value == null || value === "") return "-";
  if (type === "date") return formatDate(value);
  if (type === "decimal2") {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
      : String(value);
  }
  if (type === "number" || type === "shipQty") {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("th-TH", { maximumFractionDigits: 4 })
      : String(value);
  }
  return String(value);
}

function toNum(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function roundCalc(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** รวมน้ำหนักเคลม / จำนวนเงิน จากจำนวนแผ่นเล็ก × น้ำหนักหรือราคา/แผ่น (จาก ERP) */
function calcClaimTotals(record, claimQty) {
  const updates = {};
  const weightPerSheet = toNum(record?.weight_per_sheet);
  const pricePerSheet = toNum(record?.price_per_sheet);

  if (claimQty == null) {
    updates.claim_weight_kg = null;
    updates.claim_amount = null;
    return updates;
  }
  if (weightPerSheet != null) {
    updates.claim_weight_kg = roundCalc(claimQty * weightPerSheet);
  }
  if (pricePerSheet != null) {
    updates.claim_amount = roundCalc(claimQty * pricePerSheet);
  }
  return updates;
}

/**
 * Keep post-claim qty/weight/amount in sync with claim data.
 * claim_sheet_qty = destroy_bl_qty + return_to_customer_qty
 * destroy/return ห้ามเกินจำนวนเคลม
 */
function calcPostClaimFromClaim(record, allValues, changed) {
  const weightPerSheet = toNum(record?.weight_per_sheet);
  const pricePerSheet = toNum(record?.price_per_sheet);
  let claimQty = toNum(allValues.claim_sheet_qty);
  let destroyQty = toNum(allValues.destroy_bl_qty);
  let returnQty = toNum(allValues.return_to_customer_qty);
  const updates = {};

  const clampToClaim = (qty) => {
    if (qty == null) return null;
    let next = Math.max(0, qty);
    if (claimQty != null) next = Math.min(next, claimQty);
    return next;
  };

  if (changed === "destroy_bl_qty") {
    if (destroyQty != null) {
      const clamped = clampToClaim(destroyQty);
      if (clamped !== destroyQty) {
        destroyQty = clamped;
        updates.destroy_bl_qty = destroyQty;
      }
      if (claimQty != null) {
        returnQty = Math.max(0, claimQty - destroyQty);
        updates.return_to_customer_qty = returnQty;
      }
    }
  } else if (changed === "return_to_customer_qty") {
    if (returnQty != null) {
      const clamped = clampToClaim(returnQty);
      if (clamped !== returnQty) {
        returnQty = clamped;
        updates.return_to_customer_qty = returnQty;
      }
      if (claimQty != null) {
        destroyQty = Math.max(0, claimQty - returnQty);
        updates.destroy_bl_qty = destroyQty;
      }
    }
  } else if (changed === "claim_sheet_qty") {
    Object.assign(updates, calcClaimTotals(record, claimQty));
    if (claimQty != null && destroyQty != null) {
      destroyQty = clampToClaim(destroyQty);
      updates.destroy_bl_qty = destroyQty;
      returnQty = Math.max(0, claimQty - destroyQty);
      updates.return_to_customer_qty = returnQty;
    }
  }

  const finalDestroy = "destroy_bl_qty" in updates ? updates.destroy_bl_qty : destroyQty;
  const finalReturn =
    "return_to_customer_qty" in updates ? updates.return_to_customer_qty : returnQty;

  if (weightPerSheet != null) {
    if (finalDestroy != null) {
      updates.destroy_bl_weight = roundCalc(finalDestroy * weightPerSheet);
    }
    if (finalReturn != null) {
      updates.return_kg = roundCalc(finalReturn * weightPerSheet);
    }
  }

  if (pricePerSheet != null) {
    if (finalDestroy != null) {
      updates.destroy_bl_amount = roundCalc(finalDestroy * pricePerSheet);
    }
    if (finalReturn != null) {
      updates.return_amount = roundCalc(finalReturn * pricePerSheet);
    }
  }

  return updates;
}

/** Fields auto-calculated from claim_sheet_qty × ERP weight/price — editable form but read-only UI. */
const COMPUTED_CLAIM_FIELDS = new Set(["claim_weight_kg", "claim_amount"]);

function toFormValues(record) {
  const values = {};
  for (const name of QC_REQUIRED_FIELDS) {
    const value = record?.[name];
    if (name === "doc_notify_date") {
      // Auto-fill today only when empty; keep existing date otherwise.
      values[name] = value ? dayjs(value) : dayjs();
    } else if (name === "reject_received_date") {
      values[name] = value ? dayjs(value) : null;
    } else if (name === "actual_ship_qty") {
      values[name] =
        value == null || value === "" ? "" : String(Number(value));
    } else if (
      [
        "claim_sheet_qty",
        "return_to_customer_qty",
        "return_amount",
        "return_kg",
        "destroy_bl_qty",
        "destroy_bl_weight",
        "destroy_bl_amount",
      ].includes(name)
    ) {
      values[name] = value == null || value === "" ? null : Number(value);
    } else if (name === "problem_name") {
      values[name] = problemNamesOf(record);
    } else {
      values[name] = value ?? "";
    }
  }

  const claimQty = toNum(record?.claim_sheet_qty);
  const computed = calcClaimTotals(record, claimQty);
  values.claim_weight_kg =
    computed.claim_weight_kg ?? toNum(record?.claim_weight_kg);
  values.claim_amount = computed.claim_amount ?? toNum(record?.claim_amount);
  return values;
}

/** View-mode: show stored claim totals, or compute from ERP weight/price when empty. */
function withClaimDisplay(record) {
  if (!record) return record;
  const claimQty = toNum(record.claim_sheet_qty);
  const computed = calcClaimTotals(record, claimQty);
  return {
    ...record,
    claim_weight_kg:
      toNum(record.claim_weight_kg) ?? computed.claim_weight_kg ?? record.claim_weight_kg,
    claim_amount:
      toNum(record.claim_amount) ?? computed.claim_amount ?? record.claim_amount,
  };
}

/** Keep input rows level when labels wrap to 1–2 lines (avoids “wave” alignment). */
const FIELD_ITEM_CLASS =
  "!mb-3 [&_.ant-form-item-label]:min-h-[2.75rem] [&_.ant-form-item-label]:!pb-1 [&_.ant-form-item-label_>label]:!h-auto [&_.ant-form-item-label_>label]:!whitespace-normal";

function FieldLabel({ label, required }) {
  return (
    <span>
      <span>{label}</span>
      {required ? (
        <span className="ml-1 font-semibold text-red-600" title="ต้องกรอก">
          *
        </span>
      ) : null}
    </span>
  );
}

function sanitizeShipQtyInput(value) {
  if (value == null) return "";
  // อนุญาตตัวเลข ทศนิยม จุลภาค และ * เท่านั้น (รูปแบบ 250*3)
  return String(value).replace(/[^\d.*,]/g, "");
}

function ShipQtyInput({ className, value, onChange, ...rest }) {
  return (
    <Input
      {...rest}
      className={className}
      value={value ?? ""}
      placeholder="เช่น 4100 หรือ 250*3"
      inputMode="decimal"
      onChange={(event) =>
        onChange?.(sanitizeShipQtyInput(event.target.value))
      }
      onKeyDown={(event) => {
        const key = event.key;
        if (
          key.length === 1 &&
          !/[0-9.*,]/.test(key) &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
        }
      }}
      onBeforeInput={(event) => {
        if (event.data && /[^\d.*,]/.test(event.data)) {
          event.preventDefault();
        }
      }}
      onPaste={(event) => {
        event.preventDefault();
        const text = event.clipboardData?.getData("text") ?? "";
        const cleaned = sanitizeShipQtyInput(text);
        const input = event.target;
        const start = input.selectionStart ?? String(value ?? "").length;
        const end = input.selectionEnd ?? start;
        const current = String(value ?? "");
        onChange?.(
          sanitizeShipQtyInput(
            current.slice(0, start) + cleaned + current.slice(end),
          ),
        );
      }}
      onBlur={() => {
        const parsed = parseShipQty(value);
        if (parsed != null) onChange?.(String(parsed));
      }}
    />
  );
}

function sanitizeNumericInput(value, { allowDecimal = true } = {}) {
  if (value == null) return "";
  const raw = String(value);
  if (!allowDecimal) return raw.replace(/[^\d]/g, "");
  const cleaned = raw.replace(/[^\d.]/g, "");
  const [whole, ...rest] = cleaned.split(".");
  if (!rest.length) return cleaned;
  return `${whole}.${rest.join("")}`;
}

function FormField({
  field,
  className = "",
  selectOptions = {},
  problemNames,
  onProblemNamesChange,
}) {
  const [name, label, type] = field;
  const inputClass = "!border-red-300 !bg-red-50/40";
  const options = selectOptions[name] || [];
  const claimSheetQty = Form.useWatch("claim_sheet_qty");
  const claimQty = toNum(claimSheetQty);
  const isClaimCappedQty =
    name === "destroy_bl_qty" || name === "return_to_customer_qty";
  const isDecimalField = type === "decimal2";
  const isNumericField = type === "number" || type === "decimal2";

  if (name === "problem_name") {
    return (
      <div className={`min-w-0 ${className}`}>
        <ProblemFormItem
          label={<FieldLabel label={label} required />}
          extra="เลือกได้มากกว่า 1 ปัญหา — ช่องจะขยายตามจำนวนที่เลือก"
          options={options}
          className={FIELD_ITEM_CLASS}
          required
          value={problemNames}
          onChange={onProblemNamesChange}
        />
      </div>
    );
  }

  const rules = [];
  if (type === "shipQty") {
    rules.push({
      validator: (_, value) => {
        if (value == null || String(value).trim() === "") {
          return Promise.resolve();
        }
        if (parseShipQty(value) == null) {
          return Promise.reject(new Error("กรอกตัวเลข หรือรูปแบบ เช่น 250*3"));
        }
        return Promise.resolve();
      },
    });
  }
  if (isClaimCappedQty) {
    rules.push({
      validator: (_, value) => {
        if (value == null || value === "") return Promise.resolve();
        const number = Number(value);
        if (!Number.isFinite(number)) return Promise.resolve();
        if (number < 0) {
          return Promise.reject(new Error("ต้องไม่ติดลบ"));
        }
        if (claimQty != null && number > claimQty) {
          return Promise.reject(
            new Error(
              `ต้องไม่เกินจำนวนเคลม (${claimQty.toLocaleString("th-TH")})`,
            ),
          );
        }
        return Promise.resolve();
      },
    });
  }
  if (isNumericField) {
    rules.push({
      validator: (_, value) => {
        if (value == null || value === "") return Promise.resolve();
        if (!Number.isFinite(Number(value))) {
          return Promise.reject(new Error("กรอกได้เฉพาะตัวเลข"));
        }
        return Promise.resolve();
      },
    });
  }

  return (
    <div className={`min-w-0 ${className}`}>
      <Form.Item
        name={name}
        label={<FieldLabel label={label} required />}
        className={FIELD_ITEM_CLASS}
        extra={
          type === "shipQty" ? (
            <span className="text-[11px] text-slate-500">
              แผ่นเล็ก หรือ แผ่นใหญ่*ตัวคูณ เช่น 250*3
            </span>
          ) : null
        }
        rules={rules.length ? rules : undefined}
      >
        {type === "textarea" ? (
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} className={inputClass} />
        ) : type === "date" ? (
          <DatePicker className={`w-full ${inputClass}`} format="DD/MM/YYYY" />
        ) : type === "shipQty" ? (
          <ShipQtyInput className={inputClass} />
        ) : isNumericField ? (
          <InputNumber
            className={`w-full ${inputClass}`}
            controls={false}
            inputMode="decimal"
            min={isClaimCappedQty ? 0 : undefined}
            max={isClaimCappedQty && claimQty != null ? claimQty : undefined}
            precision={isDecimalField ? 2 : undefined}
            parser={(value) =>
              sanitizeNumericInput(value, { allowDecimal: true })
            }
            onKeyDown={(event) => {
              const key = event.key;
              if (
                key.length === 1 &&
                !/[0-9.]/.test(key) &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
              ) {
                event.preventDefault();
              }
            }}
            onBeforeInput={(event) => {
              if (event.data && /[^\d.]/.test(event.data)) {
                event.preventDefault();
              }
            }}
            onPaste={(event) => {
              const text = event.clipboardData?.getData("text") ?? "";
              if (/[^\d.]/.test(text)) {
                event.preventDefault();
              }
            }}
          />
        ) : type === "select" ? (
          <Select
            className="w-full"
            classNames={{ popup: { root: "qc-select-dropdown" } }}
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="เลือก"
            options={options}
          />
        ) : (
          <Input className={inputClass} />
        )}
      </Form.Item>
    </div>
  );
}

/** Read-only computed claim fields (weight/amount) — still registered so save includes them. */
function ComputedClaimField({ field, className = "" }) {
  const [name, label, type] = field;
  const isDecimalField = type === "decimal2";

  return (
    <div className={`min-w-0 ${className}`}>
      <Form.Item
        name={name}
        label={<FieldLabel label={label} />}
        className={FIELD_ITEM_CLASS}
        extra={
          <span className="text-[11px] text-slate-500">
            {name === "claim_weight_kg"
              ? "คำนวณจาก ลูกค้าเคลม × น้ำหนัก/แผ่น"
              : "คำนวณจาก ลูกค้าเคลม × ราคา/แผ่นเล็ก"}
          </span>
        }
      >
        <InputNumber
          className="w-full !bg-slate-50"
          controls={false}
          disabled
          precision={isDecimalField ? 2 : undefined}
        />
      </Form.Item>
    </div>
  );
}

function ReadOnlyField({ record, field, className = "", highlightQc }) {
  const [name, label, type] = field;
  const required = highlightQc && QC_REQUIRED_FIELDS.has(name);
  if (name === "problem_name") {
    const names = problemNamesOf(record);
    return (
      <div className={`min-w-0 ${className}`}>
        <Form.Item
          label={<FieldLabel label={label} required={required} />}
          className={FIELD_ITEM_CLASS}
        >
          <div
            className={`min-h-[32px] rounded-md border px-2 py-1.5 ${
              required ? "border-red-300 bg-red-50/60" : "border-slate-200 bg-white"
            }`}
          >
            <ProblemChips names={names} />
          </div>
        </Form.Item>
      </div>
    );
  }
  const value = displayValue(record[name], type);

  return (
    <div className={`min-w-0 ${className}`}>
      <Form.Item
        label={<FieldLabel label={label} required={required} />}
        className={FIELD_ITEM_CLASS}
      >
        {type === "textarea" ? (
          <Input.TextArea
            value={value}
            readOnly
            autoSize={{ minRows: 2, maxRows: 5 }}
            className={required ? "!border-red-300 !bg-red-50/60" : undefined}
          />
        ) : (
          <Input
            value={value}
            readOnly
            className={required ? "!border-red-300 !bg-red-50/60" : undefined}
          />
        )}
      </Form.Item>
    </div>
  );
}

function sectionGridClass(layout) {
  if (layout === "fiveThenSix") return "xl:grid-cols-[repeat(30,minmax(0,1fr))]";
  if (layout === "fiveThenThree") return "xl:grid-cols-[repeat(15,minmax(0,1fr))]";
  if (layout === "three") return "xl:grid-cols-3";
  if (layout === "six") return "xl:grid-cols-6";
  return "xl:grid-cols-5";
}

function fieldSpanClass(layout, index) {
  if (layout === "fiveThenSix") return index < 5 ? "xl:col-span-6" : "xl:col-span-5";
  if (layout === "fiveThenThree") return index < 5 ? "xl:col-span-3" : "xl:col-span-5";
  return "";
}

export function RejectForm({ record, onSaved, onReturned }) {
  const { message, modal } = App.useApp();
  const { user } = useSession();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [returning, setReturning] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const enrichedIdRef = useRef(null);
  const [selectOptions, setSelectOptions] = useState({
    department_name: [],
    problem_name: [],
    job_type: [],
  });
  const [selectedProblemNames, setSelectedProblemNames] = useState(() =>
    problemNamesOf(record),
  );

  const isErpDraft = Boolean(record?._fromErp) || record?.id == null;
  const fromComplaint = record?.source === "complaint";
  // ERP draft: QC แก้/บันทึกได้ — บันทึกเข้า CMS ตอนกดบันทึกครั้งแรก
  const canEdit = canUpdateRejects(user);
  const isQc = canEdit;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  // ดึง ERP เติมช่องว่างเฉพาะใบที่มาจาก Complaint (stub)
  // ใบจาก Excel / ERP ปกติที่มีใน CMS แล้ว — ไม่เรียก
  useEffect(() => {
    const id = record?.id;
    if (!id || record?._fromErp || !canEdit) return;
    if (record?.source !== "complaint") return;
    if (enrichedIdRef.current === Number(id)) return;

    const needsEnrich = !record.sale_order_no || !record.size;
    if (!needsEnrich) {
      enrichedIdRef.current = Number(id);
      return;
    }

    let cancelled = false;
    enrichedIdRef.current = Number(id);
    setEnriching(true);

    rejectApi
      .enrichFromErp(id)
      .then((result) => {
        if (cancelled) return;
        if (result?.data) onSavedRef.current?.(result.data);
        if (result?.changed) {
          message.info("ดึงข้อมูล Reject จาก ERP แล้ว");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        message.warning(error?.message || "ดึงข้อมูลจาก ERP ไม่สำเร็จ");
      })
      .finally(() => {
        if (!cancelled) setEnriching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    record?.id,
    record?._fromErp,
    record?.source,
    record?.sale_order_no,
    record?.size,
    canEdit,
    message,
  ]);

  useEffect(() => {
    setEditing(false);
    form.setFieldsValue(toFormValues(record));
    setSelectedProblemNames(problemNamesOf(record));
  }, [record, form]);

  useEffect(() => {
    let alive = true;
    rejectApi
      .formOptions()
      .then((result) => {
        if (!alive) return;
        const toOptions = (rows) =>
          (rows || []).map((row) => ({
            value: row.name,
            label: row.name,
          }));
        setSelectOptions({
          department_name: toOptions(result.departments),
          problem_name: toOptions(result.problems),
          job_type: toOptions(result.job_types),
        });
      })
      .catch(() => {
        // keep empty options; user can still save other fields
      });
    return () => {
      alive = false;
    };
  }, []);

  const mergedSelectOptions = useMemo(() => {
    const ensure = (options, value) => {
      if (!value) return options;
      if (options.some((item) => item.value === value)) return options;
      return [{ value, label: value }, ...options];
    };
    return {
      department_name: ensure(selectOptions.department_name, record?.department_name),
      problem_name: ensureProblemOptions(
        selectOptions.problem_name,
        problemNamesOf(record),
      ),
      job_type: ensure(selectOptions.job_type, record?.job_type),
    };
  }, [selectOptions, record]);

  const alertMessage = useMemo(() => {
    if (enriching) return "กำลังดึงข้อมูล Reject จาก ERP…";
    if (isErpDraft) return "ข้อมูลจาก ERP พร้อมแล้ว — กรอกช่อง QC แล้วกดบันทึกเพื่อบันทึกลง CMS";
    if (editing) return "กำลังแก้ไขช่อง * — กดบันทึกเมื่อแก้เสร็จ (แก้ซ้ำได้เรื่อยๆ)";
    if (fromComplaint && isQc) {
      return "รายการจาก Complaint — กรอกช่อง QC แล้วกดบันทึก · หลังบันทึกกด「แก้ไขอีกครั้ง」ได้ตลอด";
    }
    if (isQc && record?.id) {
      return "บันทึกแล้ว — กด「แก้ไขอีกครั้ง」เพื่อแก้ช่อง QC ได้เรื่อยๆ (มี Activity Log)";
    }
    if (isQc) return "ช่อง * คือข้อมูลที่ QC ต้องกรอกหรือแก้ไข";
    return "ช่อง * คือข้อมูลที่แผนก QC รับผิดชอบ";
  }, [editing, isQc, isErpDraft, fromComplaint, enriching, record?.id]);

  if (!record) return null;

  const displayRecord = withClaimDisplay(record);

  const startEdit = () => {
    form.setFieldsValue(toFormValues(record));
    setSelectedProblemNames(problemNamesOf(record));
    setEditing(true);
  };

  const cancelEdit = () => {
    form.setFieldsValue(toFormValues(record));
    setSelectedProblemNames(problemNamesOf(record));
    setEditing(false);
  };

  const handleValuesChange = (changedValues, allValues) => {
    const changed = Object.keys(changedValues)[0];
    if (
      ![
        "claim_sheet_qty",
        "destroy_bl_qty",
        "return_to_customer_qty",
      ].includes(changed)
    ) {
      return;
    }
    const claimQty = toNum(allValues.claim_sheet_qty);
    const entered = toNum(changedValues[changed]);
    if (
      claimQty != null &&
      entered != null &&
      (changed === "destroy_bl_qty" || changed === "return_to_customer_qty") &&
      entered > claimQty
    ) {
      message.warning(
        `จำนวนต้องไม่เกินลูกค้าเคลม (${claimQty.toLocaleString("th-TH")})`,
      );
    }
    const updates = calcPostClaimFromClaim(record, allValues, changed);
    if (Object.keys(updates).length) {
      form.setFieldsValue(updates);
    }
  };

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        ...problemSaveFields(selectedProblemNames),
        doc_notify_date: values.doc_notify_date
          ? values.doc_notify_date.format("YYYY-MM-DD")
          : null,
        reject_received_date: values.reject_received_date
          ? values.reject_received_date.format("YYYY-MM-DD")
          : null,
        actual_ship_qty: parseShipQty(values.actual_ship_qty),
        ...calcClaimTotals(record, toNum(values.claim_sheet_qty)),
      };
      let recordId = record.id;
      if (!recordId) {
        // ใช้ข้อมูลในฟอร์มที่ Search ดึงมาแล้ว — ไม่ GET ERP ซ้ำ
        const created = await rejectApi.createFromDraft({
          pdr_no: record.pdr_no,
          sale_order_no: record.sale_order_no,
          company_name: record.company_name,
          customer_alias_name: record.customer_alias_name,
          machine_name: record.machine_name,
          flute_name: record.flute_name,
          size: record.size,
          order_qty: record.order_qty,
          demand_qty: record.demand_qty,
          shift: record.shift,
          vehicle_plate: record.vehicle_plate,
          customer_ship_date: record.customer_ship_date,
          delivery_date: record.delivery_date,
          production_date: record.production_date,
          weight_per_sheet: record.weight_per_sheet,
          price_per_sheet: record.price_per_sheet,
          cut_qty: record.cut_qty,
          item_code: record.item_code,
          big_sheet_qty: record.big_sheet_qty,
          big_sheet_size: record.big_sheet_size,
          small_sheet_size: record.small_sheet_size,
        });
        const createdRow = created?.data?.[0];
        if (!createdRow?.id) {
          throw new Error("สร้าง Reject จากข้อมูลฟอร์มไม่สำเร็จ");
        }
        recordId = createdRow.id;
      }
      // ใบจาก Complaint stub: ERP ถูกเติมตอนเปิดฟอร์มแล้ว — ไม่ GET ซ้ำตอนบันทึก
      const result = await rejectApi.update(recordId, payload);
      message.success(
        result.changed
          ? result.action === "fill"
            ? "บันทึกการกรอกฟอร์มแล้ว — กดแก้ไขอีกครั้งได้ถ้าต้องการปรับ"
            : "อัปเดตข้อมูลแล้ว — กดแก้ไขอีกครั้งได้ถ้าต้องการปรับ"
          : recordId !== record.id
            ? "บันทึกลง CMS แล้ว — กดแก้ไขอีกครั้งได้ถ้าต้องการปรับ"
            : "ไม่มีการเปลี่ยนแปลง",
      );
      setEditing(false);
      onSaved?.(result.data);
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const confirmReturnToCs = () => {
    let reason = "";
    modal.confirm({
      centered: true,
      title: "ยืนยันตีกลับไป CS",
      content: (
        <div className="mt-3 space-y-3">
          <div>
            PDR <strong>{record.pdr_no || "-"}</strong> จะถูกลบออกจากคิว
            Reject
          </div>
          <Alert
            showIcon
            type="warning"
            message="รายการนี้จะหายจากเมนู Reject"
            description="Complaint ยังเดินต่อตามปกติ ไม่ได้ยกเลิกเรื่องร้องเรียน — กรุณาระบุเหตุผลด้านล่างก่อนยืนยัน"
          />
          <div>
            <div className="mb-1 text-sm text-slate-700">
              เหตุผลที่ตีกลับ <span className="text-red-500">*</span>
            </div>
            <Input.TextArea
              autoSize={{ minRows: 3, maxRows: 6 }}
              placeholder="เช่น ส่งผิดใบ / ของไม่ต้องซ่อม / ไม่ใช่งาน Reject"
              onChange={(event) => {
                reason = event.target.value;
              }}
            />
          </div>
        </div>
      ),
      okText: "ยืนยันตีกลับ",
      okButtonProps: { danger: true },
      cancelText: "ยกเลิก",
      onOk: async () => {
        const note = String(reason || "").trim();
        if (!note) {
          message.warning("กรุณาระบุเหตุผลที่ตีกลับ");
          return Promise.reject();
        }
        setReturning(true);
        try {
          await rejectApi.returnToCs(record.id, note);
          message.success("ตีกลับไป CS แล้ว — รายการนี้ถูกลบออกจากคิว Reject");
          onReturned?.(record);
        } catch (error) {
          message.error(error.message || "ตีกลับไม่สำเร็จ");
          return Promise.reject();
        } finally {
          setReturning(false);
        }
      },
    });
  };

  return (
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      {isErpDraft ? (
        <Alert
          className="mb-3 w-fit max-w-full !px-3 !py-2"
          type="info"
          showIcon
          message="ข้อมูลจาก ERP ใส่ในฟอร์มแล้ว (ยังไม่บันทึกลง CMS) — กรอกช่อง QC แล้วกดบันทึก"
        />
      ) : null}
      {fromComplaint ? (
        <Alert
          className="mb-3 w-fit max-w-full !px-3 !py-2"
          type="error"
          showIcon
          message="รายการนี้มาจาก Complaint — CS ส่งเรื่องซ่อมมาให้ QC กรอก Reject"
        />
      ) : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Alert
          className="w-fit max-w-full !px-3 !py-2"
          type={enriching ? "info" : editing ? "info" : "warning"}
          showIcon
          message={alertMessage}
        />
        {canEdit ? (
          <Space wrap className="shrink-0">
            {fromComplaint && record?.id ? (
              <Button
                danger
                icon={<RollbackOutlined />}
                onClick={confirmReturnToCs}
                disabled={saving || enriching || returning}
              >
                ตีกลับไป CS
              </Button>
            ) : null}
            {editing ? (
              <>
                <Button icon={<CloseOutlined />} onClick={cancelEdit} disabled={saving || enriching}>
                  ยกเลิก
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  disabled={enriching}
                  onClick={saveEdit}
                >
                  บันทึก
                </Button>
              </>
            ) : (
              <Button type="primary" icon={<EditOutlined />} onClick={startEdit} disabled={enriching}>
                {record?.id ? "แก้ไขอีกครั้ง" : "แก้ไข"}
              </Button>
            )}
          </Space>
        ) : null}
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <Card key={section.title} size="small">
            <Typography.Title level={5} className="!mb-4">
              {section.title}
            </Typography.Title>
            <div
              className={`grid grid-cols-1 gap-x-3 sm:grid-cols-2 ${sectionGridClass(section.layout)}`}
            >
              {section.fields.map((field, index) => {
                const span =
                  field[0] === "problem_name"
                    ? "sm:col-span-2 xl:col-span-full"
                    : fieldSpanClass(section.layout, index);
                const [name] = field;
                const isQcField = QC_REQUIRED_FIELDS.has(name);

                if (editing && isQcField) {
                  return (
                    <FormField
                      key={name}
                      field={field}
                      className={span}
                      selectOptions={mergedSelectOptions}
                      problemNames={selectedProblemNames}
                      onProblemNamesChange={setSelectedProblemNames}
                    />
                  );
                }

                if (editing && COMPUTED_CLAIM_FIELDS.has(name)) {
                  return (
                    <ComputedClaimField
                      key={name}
                      field={field}
                      className={span}
                    />
                  );
                }

                return (
                  <ReadOnlyField
                    key={name}
                    record={displayRecord}
                    field={field}
                    highlightQc
                    className={span}
                  />
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {record?.id ? (
        <div className="mt-4">
          <RejectPdfDocuments record={displayRecord || record} />
        </div>
      ) : null}
    </Form>
  );
}
