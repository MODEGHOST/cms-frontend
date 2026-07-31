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

/** Fields that QC department must fill (Excel column mapping). */
export const QC_REQUIRED_FIELDS = new Set([
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
    layout: "fiveThenSix",
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
      ["repair_date", "วันที่ซ่อม", "date"],
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
    layout: "six",
    fields: [
      ["actual_ship_qty", "ยอดส่งจริง", "number"],
      ["claim_sheet_qty", "ลูกค้าเคลมจำนวน (แผ่นเล็ก)", "number"],
      ["weight_per_sheet", "น้ำหนัก/แผ่น", "number"],
      ["claim_weight_kg", "รวมน้ำหนักเคลม (KG)/Order", "number"],
      ["price_per_sheet", "ราคา/แผ่นเล็ก", "number"],
      ["claim_amount", "จำนวนเงิน", "number"],
    ],
  },
  {
    title: "ข้อมูลหลังการเคลม",
    fields: [
      ["sort_claim_sup_qty", "คัดเคลม SUP", "number"],
      ["sort_weight_kg", "น้ำหนัก KG", "number"],
      ["return_to_customer_qty", "คัดส่งคืนลูกค้า", "number"],
      ["return_amount", "จำนวนเงินที่ส่งคืนลูกค้า", "number"],
      ["return_kg", "จำนวน KG", "number"],
      ["destroy_bl_qty", "จำนวนแผ่นทำลาย BL", "number"],
      ["destroy_bl_weight", "น้ำหนักทำลาย BL", "number"],
      ["destroy_bl_amount", "จำนวนเงินทำลาย BL", "number"],
      ["remark", "หมายเหตุ", "textarea"],
    ],
  },
];

function displayValue(value, type) {
  if (value == null || value === "") return "-";
  if (type === "date") return formatDate(value);
  if (type === "number") {
    const number = Number(value);
    return Number.isFinite(number)
      ? number.toLocaleString("th-TH", { maximumFractionDigits: 4 })
      : String(value);
  }
  return String(value);
}

function toFormValues(record) {
  const values = {};
  for (const name of QC_REQUIRED_FIELDS) {
    const value = record?.[name];
    if (name === "reject_received_date") {
      values[name] = value ? dayjs(value) : null;
    } else if (
      [
        "actual_ship_qty",
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

function FormField({ field, className = "", selectOptions = {} }) {
  const [name, label, type] = field;
  const inputClass = "!border-red-300 !bg-red-50/40";
  const options = selectOptions[name] || [];

  return (
    <div className={`min-w-0 ${className}`}>
      <Form.Item
        name={name}
        label={<FieldLabel label={label} required />}
        className="!mb-3"
      >
        {type === "textarea" ? (
          <Input.TextArea autoSize={{ minRows: 2, maxRows: 5 }} className={inputClass} />
        ) : type === "date" ? (
          <DatePicker className={`w-full ${inputClass}`} format="DD/MM/YYYY" />
        ) : type === "number" ? (
          <InputNumber className={`w-full ${inputClass}`} controls={false} />
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
        className="!mb-3"
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

  const isQc = String(user?.department || "").toUpperCase() === "QC";
  const canEdit = isQc || user?.role === "admin";

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

  const saveEdit = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        reject_received_date: values.reject_received_date
          ? values.reject_received_date.format("YYYY-MM-DD")
          : null,
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
    <Form form={form} layout="vertical">
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
