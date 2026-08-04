import { useEffect, useMemo, useState } from "react";
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
import { EditOutlined, SaveOutlined, CloseOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { formatDate } from "../../utils/datetime";
import { useSession } from "../../hooks/useSession";
import { rejectApi } from "../../services/api";
import { canUpdateRejects } from "../../utils/authz";
import { parseShipQty } from "../../utils/parseShipQty";

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
    } else {
      values[name] = value ?? "";
    }
  }
  return values;
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

function FormField({ field, className = "", selectOptions = {} }) {
  const [name, label, type] = field;
  const inputClass = "!border-red-300 !bg-red-50/40";
  const options = selectOptions[name] || [];
  const claimSheetQty = Form.useWatch("claim_sheet_qty");
  const claimQty = toNum(claimSheetQty);
  const isClaimCappedQty =
    name === "destroy_bl_qty" || name === "return_to_customer_qty";
  const isDecimalField = type === "decimal2";
  const isNumericField = type === "number" || type === "decimal2";

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

function ReadOnlyField({ record, field, className = "", highlightQc }) {
  const [name, label, type] = field;
  const value = displayValue(record[name], type);
  const required = highlightQc && QC_REQUIRED_FIELDS.has(name);

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

export function RejectForm({ record, onSaved }) {
  const { message } = App.useApp();
  const { user } = useSession();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectOptions, setSelectOptions] = useState({
    department_name: [],
    problem_name: [],
    job_type: [],
  });

  const canEdit = canUpdateRejects(user);
  const isQc = canEdit;

  useEffect(() => {
    setEditing(false);
    form.setFieldsValue(toFormValues(record));
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
      problem_name: ensure(selectOptions.problem_name, record?.problem_name),
      job_type: ensure(selectOptions.job_type, record?.job_type),
    };
  }, [selectOptions, record]);

  const alertMessage = useMemo(() => {
    if (editing) return "กำลังแก้ไขช่อง * — ระบบบันทึก Log เมื่อกดบันทึก";
    if (isQc) return "ช่อง * คือข้อมูลที่ QC ต้องกรอกหรือแก้ไข";
    return "ช่อง * คือข้อมูลที่แผนก QC รับผิดชอบ";
  }, [editing, isQc]);

  if (!record) return null;

  const startEdit = () => {
    form.setFieldsValue(toFormValues(record));
    setEditing(true);
  };

  const cancelEdit = () => {
    form.setFieldsValue(toFormValues(record));
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
        doc_notify_date: values.doc_notify_date
          ? values.doc_notify_date.format("YYYY-MM-DD")
          : null,
        reject_received_date: values.reject_received_date
          ? values.reject_received_date.format("YYYY-MM-DD")
          : null,
        actual_ship_qty: parseShipQty(values.actual_ship_qty),
      };
      const result = await rejectApi.update(record.id, payload);
      message.success(
        result.changed
          ? result.action === "fill"
            ? "บันทึกการกรอกฟอร์มแล้ว"
            : "อัปเดตข้อมูลแล้ว"
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

  return (
    <Form form={form} layout="vertical" onValuesChange={handleValuesChange}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Alert
          className="w-fit max-w-full !px-3 !py-2"
          type={editing ? "info" : "warning"}
          showIcon
          message={alertMessage}
        />
        {canEdit ? (
          <Space wrap className="shrink-0">
            {editing ? (
              <>
                <Button icon={<CloseOutlined />} onClick={cancelEdit} disabled={saving}>
                  ยกเลิก
                </Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  loading={saving}
                  onClick={saveEdit}
                >
                  บันทึก
                </Button>
              </>
            ) : (
              <Button type="primary" icon={<EditOutlined />} onClick={startEdit}>
                แก้ไข
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
                const span = fieldSpanClass(section.layout, index);
                const [name] = field;
                const isQcField = QC_REQUIRED_FIELDS.has(name);

                if (editing && isQcField) {
                  return (
                    <FormField
                      key={name}
                      field={field}
                      className={span}
                      selectOptions={mergedSelectOptions}
                    />
                  );
                }

                return (
                  <ReadOnlyField
                    key={name}
                    record={record}
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
    </Form>
  );
}
