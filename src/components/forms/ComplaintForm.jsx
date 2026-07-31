import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Select,
  Space,
  Steps,
  Typography,
  Upload,
} from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  PaperClipOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useSession } from "../../hooks/useSession";
import { complaintApi } from "../../services/api";
import { formatDate } from "../../utils/datetime";

const STEP_ITEMS_FULL = [
  { title: "CS", description: "ขั้นตอนที่ 1" },
  { title: "QA", description: "ขั้นตอนที่ 2" },
  { title: "หน่วยงาน", description: "ขั้นตอนที่ 3" },
  { title: "QA Confirm", description: "ยืนยันปิดงาน" },
];

const STEP_ITEMS_SKIP_DEPT = [
  { title: "CS", description: "ขั้นตอนที่ 1" },
  { title: "QA", description: "ขั้นตอนที่ 2" },
  { title: "QA Confirm", description: "ยืนยันปิดงาน" },
];

const STATUS_INDEX_FULL = {
  cs_draft: 0,
  pending_qa: 1,
  qa_review: 1,
  pending_department: 2,
  department_action: 2,
  qa_confirm: 3,
  completed: 4,
};

const STATUS_INDEX_SKIP_DEPT = {
  cs_draft: 0,
  pending_qa: 1,
  qa_review: 1,
  pending_department: 2,
  department_action: 2,
  qa_confirm: 2,
  completed: 3,
};

const DOCUMENT_ACCEPTED_OPTIONS = [
  { value: "P", label: "P · รับเอกสาร" },
  { value: "O", label: "O · ไม่รับเอกสาร" },
];

function DocumentScopeCheckbox({ value, onChange }) {
  return (
    <Space size="middle" wrap>
      <Checkbox
        checked={value === "ภายใน"}
        onChange={(event) => onChange?.(event.target.checked ? "ภายใน" : null)}
      >
        ภายใน
      </Checkbox>
      <Checkbox
        checked={value === "ภายนอก"}
        onChange={(event) => onChange?.(event.target.checked ? "ภายนอก" : null)}
      >
        ภายนอก
      </Checkbox>
    </Space>
  );
}

function needsDepartmentStep(documentAccepted) {
  return String(documentAccepted || "").toUpperCase() !== "O";
}

const GROUP_BY_STATUS = {
  cs_draft: "cs",
  pending_qa: "cs",
  qa_review: "qa",
  pending_department: "qa",
  department_action: "department",
  qa_confirm: "qa",
};

function isCsUser(user) {
  if (user?.role === "admin") return true;
  const department = String(user?.department || "").trim().toUpperCase();
  return department === "CS" || department === "CUSTOMER SERVICE";
}

function isQaUser(user) {
  if (user?.role === "admin") return true;
  const department = String(user?.department || "").trim().toUpperCase();
  return department === "QA" || department === "QC";
}

function normalizeDeptName(value) {
  return String(value || "").trim().toUpperCase();
}

function isResponsibleDepartmentUser(user, record) {
  if (user?.role === "admin") return true;
  const userDept = normalizeDeptName(user?.department);
  const responsible = normalizeDeptName(record?.responsible_department_name);
  return Boolean(userDept && responsible && userDept === responsible);
}

function canCsEdit(status, user) {
  return isCsUser(user) && (status === "cs_draft" || status === "pending_qa");
}

function canQaEdit(status, user) {
  return isQaUser(user) && (status === "qa_review" || status === "pending_department");
}

function canDepartmentEdit(status, user, record) {
  return status === "department_action" && isResponsibleDepartmentUser(user, record);
}

function canEditStep(status, user, record) {
  if (user?.role === "admin") return status !== "completed";
  if (canCsEdit(status, user)) return true;
  if (status === "pending_qa") return isQaUser(user);
  if (status === "pending_department") {
    return isQaUser(user) || isResponsibleDepartmentUser(user, record);
  }
  if (status === "qa_review" || status === "qa_confirm") {
    return isQaUser(user);
  }
  if (canDepartmentEdit(status, user, record)) return true;
  return false;
}

const SECTIONS = [
  {
    key: "document",
    title: "ข้อมูลเอกสาร ลูกค้า และวันที่",
    fields: [
      ["pdr_no", "เลข PDR", "text", "source"],
      ["order_no", "Order", "text", "source"],
      ["company_name", "ชื่อลูกค้า", "text", "source"],
      ["customer_alias_name", "Customer", "text", "source"],
      ["delivery_date", "วันส่งมอบ", "date", "source"],
      ["production_date", "วันผลิต", "date", "source"],
      ["received_date", "วันที่รับเรื่อง", "date", "cs"],
      ["sale_cs_staff", "เจ้าหน้าที่ Sale/CS", "text", "source"],
      ["reported_by_department_name", "หน่วยงานที่แจ้งปัญหา", "select", "qa"],
      ["responsible_department_name", "หน่วยงานที่รับผิดชอบ", "select", "qa"],
    ],
  },
  {
    key: "production",
    title: "ข้อมูลสินค้าและการผลิต",
    fields: [
      ["product_name", "ชื่อสินค้า", "text", "source"],
      ["flute_name", "ลอน", "select", "source"],
      ["paper_m5", "M5", "text", "source"],
      ["paper_m4", "M4", "text", "source"],
      ["paper_m3", "M3", "text", "source"],
      ["paper_m2", "M2", "text", "source"],
      ["paper_m1", "M1", "text", "source"],
      ["demand_qty", "ต้องการจริง", "number", "source"],
      ["plan_no", "แผน", "text", "source"],
      ["machine_name", "เครื่อง", "select", "source"],
      ["shift", "กะ", "select", "source"],
      ["ng_qty", "ของเสีย / NG Qty", "number", "cs"],
    ],
  },
  {
    key: "quality",
    title: "ข้อมูลปัญหาและเอกสาร",
    fields: [
      ["problem_name", "ปัญหา", "select", "cs"],
      ["problem_name_en", "Problem", "text", "source"],
      ["grade", "Grade", "select", "source"],
      ["document_accepted", "เอกสาร (รับ/ไม่รับ)", "select", "cs"],
      ["document_scope", "เอกสารภายใน/ภายนอก", "select", "qa"],
      ["document_no", "เลขที่เอกสาร", "text", "qa"],
      ["doc_forward_date", "วันที่ส่งต่อเอกสาร", "date", "department"],
      ["doc_receiver", "ผู้รับเอกสาร", "text", "department"],
      ["doc_reply_date", "วันที่รับเอกสารตอบกลับ", "date", "department"],
      ["doc_cs_sale_date", "วันที่ส่งเอกสาร CS&Sale", "date", "department"],
      ["lead_time_days", "Lead time (วัน)", "number", "department"],
    ],
  },
  {
    key: "action",
    title: "การวิเคราะห์และการดำเนินการ",
    fields: [
      ["completed_date", "วันที่แก้ไขแล้วเสร็จ", "date", "department"],
      ["cause", "สาเหตุ", "textarea", "department"],
      ["correction", "แก้ไข", "textarea", "department"],
      ["prevention", "ป้องกัน", "textarea", "department"],
      ["remark", "หมายเหตุ", "textarea", "department"],
    ],
  },
];

function userFieldGroup(user, activeGroup) {
  if (user?.role === "admin") return activeGroup;
  const department = String(user?.department || "").trim().toUpperCase();
  if (department === "CS" || department === "CUSTOMER SERVICE") return "cs";
  if (department === "QA" || department === "QC") return "qa";
  return department ? "department" : null;
}

function FieldLabel({ label, required }) {
  return (
    <span>
      {label}
      {required ? <span className="ml-1 font-semibold text-red-600">*</span> : null}
    </span>
  );
}

function displayValue(value, type) {
  if (value == null || value === "") return "-";
  if (type === "date") return formatDate(value);
  if (type === "number") {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString("th-TH") : String(value);
  }
  return String(value);
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function AttachmentGallery({ attachments = [] }) {
  if (!attachments.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
        ยังไม่มีไฟล์แนบ
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {attachments.map((attachment) => {
        const isImage = String(attachment.mime_type || "").startsWith("image/");
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-red-300 hover:shadow-sm"
          >
            {isImage ? (
              <img
                src={`${attachment.url}?inline=1`}
                alt={attachment.original_name}
                className="h-32 w-full bg-slate-50 object-contain"
              />
            ) : (
              <div className="flex h-24 items-center justify-center bg-slate-50 text-3xl text-slate-400">
                <PaperClipOutlined />
              </div>
            )}
            <div className="p-3">
              <div className="truncate text-sm font-medium">{attachment.original_name}</div>
              <div className="mt-1 text-xs text-slate-400">
                {formatFileSize(attachment.file_size)}
                {attachment.uploaded_by_name ? ` · ${attachment.uploaded_by_name}` : ""}
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

function toUploadFileList(attachments = []) {
  return attachments.map((attachment) => ({
    uid: `existing-${attachment.id}`,
    name: attachment.original_name,
    status: "done",
    url: attachment.url,
    thumbUrl: String(attachment.mime_type || "").startsWith("image/")
      ? `${attachment.url}?inline=1`
      : undefined,
    type: attachment.mime_type,
    size: Number(attachment.file_size || 0),
    attachmentId: attachment.id,
  }));
}

function buildAttachmentFormData(data, fileList, existingAttachments = []) {
  const retainedIds = new Set(
    fileList
      .filter((item) => item.attachmentId)
      .map((item) => Number(item.attachmentId)),
  );
  const removedIds = existingAttachments
    .map((attachment) => Number(attachment.id))
    .filter((id) => !retainedIds.has(id));
  data.append("remove_attachment_ids", JSON.stringify(removedIds));
  for (const item of fileList.filter((file) => !file.attachmentId)) {
    data.append("files", item.originFileObj || item);
  }
}

function formValues(record) {
  const values = {};
  for (const section of SECTIONS) {
    for (const [name, , type] of section.fields) {
      if (Object.prototype.hasOwnProperty.call(values, name)) continue;
      const value = record?.[name];
      if (type === "date") values[name] = value ? dayjs(value) : null;
      else if (type === "number") values[name] = value == null ? null : Number(value);
      else values[name] = value ?? "";
    }
  }
  return values;
}

function ReadOnlyField({ field, record, highlighted }) {
  const [name, label, type] = field;
  const value = displayValue(record?.[name], type);
  return (
    <Form.Item label={<FieldLabel label={label} required={highlighted} />} className="!mb-3">
      {type === "textarea" ? (
        <Input.TextArea
          value={value}
          readOnly
          autoSize={{ minRows: 3, maxRows: 7 }}
          className={highlighted ? "!border-red-300 !bg-red-50/50" : undefined}
        />
      ) : (
        <Input
          value={value}
          readOnly
          className={highlighted ? "!border-red-300 !bg-red-50/50" : undefined}
        />
      )}
    </Form.Item>
  );
}

export function ComplaintForm({ record, onSaved }) {
  const { message } = App.useApp();
  const { user } = useSession();
  const [form] = Form.useForm();
  const [csForm] = Form.useForm();
  const [qaForm] = Form.useForm();
  const [deptForm] = Form.useForm();
  const [qaConfirmForm] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState({});
  const [csModalOpen, setCsModalOpen] = useState(false);
  const [qaModalOpen, setQaModalOpen] = useState(false);
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [qaConfirmModalOpen, setQaConfirmModalOpen] = useState(false);
  const [fileList, setFileList] = useState([]);
  const qaDocumentAccepted = Form.useWatch("document_accepted", qaForm);

  const status = record?.workflow_status || "cs_draft";
  const activeGroup = GROUP_BY_STATUS[status];
  const csEditable = canCsEdit(status, user);
  const qaEditable = canQaEdit(status, user);
  const departmentEditable = canDepartmentEdit(status, user, record);
  const permitted = canEditStep(status, user, record);
  const highlightedGroup = userFieldGroup(user, activeGroup);
  const showDepartmentStep = needsDepartmentStep(record?.document_accepted);
  const responsibleName = record?.responsible_department_name || "หน่วยงานที่รับผิดชอบ";
  const canAcceptAsDepartment =
    status === "pending_department" && isResponsibleDepartmentUser(user, record);

  useEffect(() => {
    setCsModalOpen(false);
    setQaModalOpen(false);
    setDeptModalOpen(false);
    setQaConfirmModalOpen(false);
    setFileList([]);
  }, [record?.id, record?.workflow_status]);

  useEffect(() => {
    form.setFieldsValue(formValues(record));
  }, [record, form]);

  useEffect(() => {
    if (!qaModalOpen || qaDocumentAccepted !== "P") return;
    const current = qaForm.getFieldValue("document_no");
    if (current) return;
    let cancelled = false;
    complaintApi
      .nextDocumentNo()
      .then((result) => {
        if (cancelled) return;
        const nextNo = result?.data?.document_no;
        if (nextNo && !qaForm.getFieldValue("document_no")) {
          qaForm.setFieldValue("document_no", nextNo);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [qaModalOpen, qaDocumentAccepted, qaForm]);

  useEffect(() => {
    complaintApi.formOptions().then((result) => {
      const rowsToOptions = (rows, label = "name") =>
        (rows || []).map((row) => ({ value: row.name, label: row[label] || row.name }));
      setOptions({
        flute_name: rowsToOptions(result.flutes),
        machine_name: rowsToOptions(result.machines),
        problem_name: rowsToOptions(result.problems),
        reported_by_department_name: rowsToOptions(result.departments),
        responsible_department_name: rowsToOptions(result.departments),
        shift: ["A", "B", "C"].map((value) => ({ value, label: value })),
        grade: ["A", "B", "C", "D", "NEW", "X"].map((value) => ({ value, label: value })),
        document_accepted: DOCUMENT_ACCEPTED_OPTIONS,
        document_scope: ["ภายใน", "ภายนอก"].map((value) => ({ value, label: value })),
      });
    }).catch(() => {});
  }, []);

  const mergedOptions = useMemo(() => {
    const result = { ...options };
    for (const section of SECTIONS) {
      for (const [name, , type] of section.fields) {
        if (type !== "select") continue;
        const current = record?.[name];
        if (!current) continue;
        const list = result[name] || [];
        if (!list.some((item) => item.value === current)) {
          result[name] = [{ value: current, label: current }, ...list];
        }
      }
    }
    return result;
  }, [options, record]);

  if (!record) return null;

  const confirm = async () => {
    try {
      setSaving(true);
      const result = await complaintApi.update(record.id, { action: "confirm" });
      message.success("QA Confirm และปิดงานเรียบร้อย");
      onSaved?.(result.data);
    } catch (error) {
      message.error(error.message || "Confirm ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openQaConfirmModal = () => {
    qaConfirmForm.setFieldsValue({
      cause: record.cause || "",
      correction: record.correction || "",
      prevention: record.prevention || "",
      remark: record.remark || "",
    });
    setQaConfirmModalOpen(true);
  };

  const saveQaConfirmEdits = async () => {
    try {
      const values = await qaConfirmForm.validateFields();
      setSaving(true);
      const result = await complaintApi.update(record.id, {
        action: "save",
        cause: values.cause || "",
        correction: values.correction || "",
        prevention: values.prevention || "",
        remark: values.remark || "",
      });
      message.success("บันทึกการแก้ไขแล้ว");
      setQaConfirmModalOpen(false);
      onSaved?.(result.data);
    } catch (error) {
      if (!error?.errorFields) message.error(error.message || "บันทึกการแก้ไขไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openCsModal = () => {
    csForm.setFieldsValue({
      problem_name: record.problem_name || null,
      ng_qty: record.ng_qty == null ? null : Number(record.ng_qty),
      received_date: record.received_date ? dayjs(record.received_date) : dayjs(),
      document_accepted: record.document_accepted || null,
    });
    setFileList(toUploadFileList(record.attachments || []));
    setCsModalOpen(true);
  };

  const submitCs = async () => {
    try {
      const values = await csForm.validateFields();
      const data = new FormData();
      data.append("problem_name", values.problem_name);
      data.append("ng_qty", String(values.ng_qty));
      data.append(
        "received_date",
        values.received_date ? values.received_date.format("YYYY-MM-DD") : "",
      );
      data.append("document_accepted", values.document_accepted || "");
      data.append("action", "submit");
      buildAttachmentFormData(data, fileList, record.attachments || []);
      setSaving(true);
      const result = await complaintApi.submitCs(record.id, data);
      message.success(
        status === "pending_qa"
          ? "อัปเดตข้อมูล CS แล้ว (แก้ได้จนกว่า QA จะรับเรื่อง)"
          : "บันทึกข้อมูล CS แล้ว ส่งรอ QA รับเรื่อง",
      );
      setCsModalOpen(false);
      setFileList([]);
      onSaved?.(result.data);
    } catch (error) {
      if (!error?.errorFields) message.error(error.message || "บันทึกข้อมูล CS ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const acceptByQa = async () => {
    try {
      setSaving(true);
      const result = await complaintApi.accept(record.id);
      message.success("รับเรื่องแล้ว — CS ไม่สามารถแก้ไขได้อีก");
      onSaved?.(result.data);
    } catch (error) {
      message.error(error.message || "รับเรื่องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const acceptByDepartment = async () => {
    try {
      setSaving(true);
      const result = await complaintApi.accept(record.id);
      message.success(`รับเรื่องแล้ว — ${responsibleName} กรอกสาเหตุ/แก้ไข/ป้องกันได้`);
      onSaved?.(result.data);
    } catch (error) {
      message.error(error.message || "รับเรื่องไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openQaModal = async () => {
    const accepted = record.document_accepted || null;
    let documentNo = record.document_no || "";
    if (accepted === "P" && !documentNo) {
      try {
        const result = await complaintApi.nextDocumentNo();
        documentNo = result?.data?.document_no || "";
      } catch {
        documentNo = "";
      }
    }
    qaForm.setFieldsValue({
      reported_by_department_name: record.reported_by_department_name || null,
      responsible_department_name: record.responsible_department_name || null,
      document_accepted: accepted,
      document_scope: record.document_scope || null,
      document_no: documentNo || null,
    });
    setQaModalOpen(true);
  };

  const submitQa = async () => {
    try {
      const values = await qaForm.validateFields();
      const isP = String(values.document_accepted || "").toUpperCase() === "P";
      setSaving(true);
      const result = await complaintApi.update(record.id, {
        action: "submit",
        reported_by_department_name: values.reported_by_department_name,
        responsible_department_name: values.responsible_department_name,
        document_accepted: values.document_accepted,
        document_scope: isP ? values.document_scope || null : null,
        document_no: isP ? values.document_no || null : null,
      });
      const nextIsDepartment = needsDepartmentStep(values.document_accepted);
      message.success(
        nextIsDepartment
          ? `บันทึกข้อมูล QA แล้ว — รอ ${values.responsible_department_name || "หน่วยงาน"} รับเรื่อง`
          : "บันทึกข้อมูล QA แล้ว — สถานะ O (ไม่รับเอกสาร) ข้ามหน่วยงาน ไป QA Confirm",
      );
      setQaModalOpen(false);
      onSaved?.(result.data);
    } catch (error) {
      if (!error?.errorFields) message.error(error.message || "บันทึกข้อมูล QA ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const openDeptModal = async () => {
    let latest = record;
    try {
      const result = await complaintApi.ensureDocFields(record.id);
      if (result?.data) {
        latest = result.data;
        onSaved?.(result.data);
      }
    } catch {
      // ยังเปิดฟอร์มได้ แม้เติมค่าอัตโนมัติไม่สำเร็จ
    }
    deptForm.setFieldsValue({
      cause: latest.cause || "",
      correction: latest.correction || "",
      prevention: latest.prevention || "",
      completed_date: latest.completed_date ? dayjs(latest.completed_date) : null,
      remark: latest.remark || "",
    });
    setFileList(toUploadFileList(latest.attachments || []));
    setDeptModalOpen(true);
  };

  const submitDepartment = async (action = "submit") => {
    try {
      const values =
        action === "submit"
          ? await deptForm.validateFields()
          : deptForm.getFieldsValue();
      const data = new FormData();
      data.append("cause", values.cause || "");
      data.append("correction", values.correction || "");
      data.append("prevention", values.prevention || "");
      data.append(
        "completed_date",
        values.completed_date ? values.completed_date.format("YYYY-MM-DD") : "",
      );
      data.append("remark", values.remark || "");
      data.append("action", action);
      buildAttachmentFormData(data, fileList, record.attachments || []);
      setSaving(true);
      const result = await complaintApi.submitDepartment(record.id, data);
      message.success(
        action === "submit"
          ? "บันทึกข้อมูลหน่วยงานและส่งต่อ QA Confirm แล้ว"
          : "บันทึกร่างแล้ว",
      );
      if (action === "submit") {
        setDeptModalOpen(false);
        setFileList([]);
      } else {
        setFileList(toUploadFileList(result.data?.attachments || []));
      }
      onSaved?.(result.data);
    } catch (error) {
      if (!error?.errorFields) message.error(error.message || "บันทึกข้อมูลหน่วยงานไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const stepItems = showDepartmentStep ? STEP_ITEMS_FULL : STEP_ITEMS_SKIP_DEPT;
  const stepIndex = (showDepartmentStep ? STATUS_INDEX_FULL : STATUS_INDEX_SKIP_DEPT)[status] ?? 0;

  const alertMessage = (() => {
    if (status === "pending_qa" && isQaUser(user)) {
      return "CS ส่งเรื่องแล้ว — กดรับเรื่องเพื่อเริ่มตรวจสอบ (หลังรับเรื่อง CS จะแก้ไม่ได้)";
    }
    if (status === "pending_qa" && csEditable) {
      return "ส่งรอ QA รับเรื่องแล้ว — คุณยังแก้ไขข้อมูล CS ได้จนกว่า QA จะกดรับเรื่อง";
    }
    if (status === "pending_department" && canAcceptAsDepartment) {
      return `QA ส่งเรื่องแล้ว — กดรับเรื่องเพื่อเริ่มกรอกสาเหตุ/แก้ไข/ป้องกัน (หลังรับเรื่อง QA จะแก้ไม่ได้)`;
    }
    if (status === "pending_department" && qaEditable) {
      return `ส่งรอ ${responsibleName} รับเรื่องแล้ว — คุณยังแก้ไขข้อมูล QA ได้จนกว่าหน่วยงานจะกดรับเรื่อง`;
    }
    if (status === "pending_department") {
      return `รอ ${responsibleName} รับเรื่อง — ยังไม่ถึง Step ของคุณ`;
    }
    if (status === "qa_review" && qaEditable) {
      return "ช่อง * คือข้อมูลที่ QA ต้องกรอก — สามารถเปลี่ยน O/P ได้ แล้วส่งต่อตามสถานะ";
    }
    if (status === "department_action" && departmentEditable) {
      return `ช่อง * คือข้อมูลที่ ${responsibleName} ต้องกรอก — กดกรอกข้อมูลหน่วยงานเพื่อเปิดฟอร์ม`;
    }
    if (status === "department_action") {
      return `ขั้นตอนที่ 3 เป็นของ ${responsibleName} — ไม่ใช่ QA`;
    }
    if (status === "qa_confirm" && permitted) {
      return "ถึง Step QA Confirm — แก้ไขสาเหตุ/แก้ไข/ป้องกัน/หมายเหตุ ได้ถ้าต้องการ แล้วกดยืนยันเพื่อปิดงาน";
    }
    if (permitted) {
      return `ช่อง * คือข้อมูลที่ ${String(user?.department || "บัญชีนี้")} ต้องกรอก`;
    }
    return `ช่อง * คือข้อมูลของ ${String(user?.department || "บัญชีนี้")} — ตอนนี้ยังไม่ถึง Step ของคุณ`;
  })();

  return (
    <Form form={form} layout="vertical" className="space-y-5">
      <Card size="small" styles={{ body: { padding: "12px 18px" } }}>
        <Steps
          size="small"
          current={Math.min(stepIndex, stepItems.length - 1)}
          status={status === "completed" ? "finish" : "process"}
          items={stepItems}
          responsive
        />
        {status === "completed" ? (
          <Alert
            className="mt-4"
            type="success"
            showIcon
            message={`ปิดงานแล้ว${record.confirmed_by_name ? ` โดย ${record.confirmed_by_name}` : ""}`}
          />
        ) : null}
      </Card>

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Alert
          showIcon
          type={
            status === "pending_qa" || status === "pending_department"
              ? "warning"
              : permitted
                ? "info"
                : "warning"
          }
          message={alertMessage}
        />
        <Space wrap>
          {csEditable ? (
            <Button type="primary" icon={<EditOutlined />} onClick={openCsModal}>
              {status === "pending_qa" ? "แก้ไขข้อมูล Complaint" : "กรอกข้อมูล Complaint"}
            </Button>
          ) : null}
          {status === "pending_qa" && isQaUser(user) ? (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={saving}
              onClick={acceptByQa}
            >
              รับเรื่อง
            </Button>
          ) : null}
          {qaEditable ? (
            <Button type="primary" icon={<EditOutlined />} onClick={openQaModal}>
              {status === "pending_department" ? "แก้ไขข้อมูล QA" : "กรอกข้อมูล QA"}
            </Button>
          ) : null}
          {canAcceptAsDepartment ? (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={saving}
              onClick={acceptByDepartment}
            >
              รับเรื่อง ({responsibleName})
            </Button>
          ) : null}
          {permitted && status === "qa_confirm" ? (
            <>
              <Button icon={<EditOutlined />} onClick={openQaConfirmModal}>
                แก้ไขสาเหตุ / แก้ไข / ป้องกัน
              </Button>
              <Button
                type="primary"
                icon={<CheckCircleOutlined />}
                loading={saving}
                onClick={confirm}
              >
                QA Confirm และจบงาน
              </Button>
            </>
          ) : null}
          {departmentEditable ? (
            <Button type="primary" icon={<EditOutlined />} onClick={openDeptModal}>
              กรอกข้อมูลหน่วยงาน
            </Button>
          ) : null}
        </Space>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const isActionSection = section.key === "action";
          return (
            <Card
              key={section.key}
              size="small"
              title={<Typography.Text>{section.title}</Typography.Text>}
            >
              <div
                className={
                  isActionSection
                    ? "grid grid-cols-1 gap-x-4 sm:grid-cols-2"
                    : "grid grid-cols-1 gap-x-3 sm:grid-cols-2 xl:grid-cols-4"
                }
              >
                {section.fields.map((field) => {
                  const [name, , type, owner] = field;
                  const wide = isActionSection
                    ? type === "date"
                      ? "sm:col-span-2 sm:max-w-xs"
                      : ""
                    : type === "textarea"
                      ? "sm:col-span-2 xl:col-span-4"
                      : "";
                  const highlighted = owner === highlightedGroup;
                  return (
                    <div key={`${section.key}-${name}`} className={wide}>
                      <ReadOnlyField
                        field={field}
                        record={record}
                        highlighted={highlighted}
                      />
                    </div>
                  );
                })}
              </div>
              {section.key === "quality" ? (
                <div className="mt-2 border-t border-slate-100 pt-4">
                  <Typography.Title level={5} className="!mb-3">
                    ไฟล์แนบ
                  </Typography.Title>
                  <AttachmentGallery attachments={record.attachments || []} />
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>

      <Modal
        title="กรอกข้อมูล Complaint · CS"
        open={csModalOpen}
        onCancel={() => !saving && setCsModalOpen(false)}
        okText={status === "pending_qa" ? "บันทึกการแก้ไข" : "บันทึกและส่งรอ QA รับเรื่อง"}
        cancelText="ยกเลิก"
        confirmLoading={saving}
        onOk={submitCs}
        destroyOnHidden
        width={780}
        centered
        styles={{ body: { paddingTop: 12, paddingBottom: 8 } }}
      >
        <Alert
          className="!mb-3"
          type="info"
          showIcon
          message={`PDR: ${record.pdr_no || "-"}`}
        />
        <Form form={csForm} layout="vertical" className="complaint-cs-modal-form">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="received_date"
              label="วันที่รับเรื่อง"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณาเลือกวันที่รับเรื่อง" }]}
            >
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item
              name="problem_name"
              label="ปัญหา"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณาเลือกปัญหา" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือกปัญหา"
                options={mergedOptions.problem_name || []}
              />
            </Form.Item>
            <Form.Item
              name="ng_qty"
              label="ของเสีย / NG Q'ty"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณากรอกจำนวนของเสีย" }]}
            >
              <InputNumber className="w-full" min={0} controls={false} />
            </Form.Item>
            <Form.Item
              name="document_accepted"
            label="เอกสาร (รับ/ไม่รับ)"
            className="!mb-3"
            rules={[{ required: true, message: "กรุณาเลือก O หรือ P" }]}
          >
              <Radio.Group
                optionType="button"
                buttonStyle="solid"
                options={DOCUMENT_ACCEPTED_OPTIONS}
              />
            </Form.Item>
          </div>
          <Form.Item
            label="รูปภาพหรือไฟล์แนบ"
            className="!mb-0"
            extra="สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB"
          >
            <Upload.Dragger
              multiple
              maxCount={10}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next)}
              style={{ padding: "4px 0" }}
            >
              <p className="ant-upload-drag-icon !mb-1">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text !text-sm">คลิกหรือลากไฟล์มาวางที่นี่</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="กรอกข้อมูล Complaint · QA"
        open={qaModalOpen}
        onCancel={() => !saving && setQaModalOpen(false)}
        okText={
          needsDepartmentStep(qaDocumentAccepted ?? record.document_accepted)
            ? "บันทึกและส่งรอหน่วยงานรับเรื่อง"
            : "บันทึกและส่ง QA Confirm (ไม่รับเอกสาร)"
        }
        cancelText="ยกเลิก"
        confirmLoading={saving}
        onOk={submitQa}
        destroyOnHidden
        width={640}
        centered
      >
        <Alert
          className="!mb-3"
          type="info"
          showIcon
          message={`PDR: ${record.pdr_no || "-"}`}
        />
        <Form form={qaForm} layout="vertical">
          <Form.Item
            name="document_accepted"
            label="เอกสาร (รับ/ไม่รับ)"
            className="!mb-3"
            rules={[{ required: true, message: "กรุณาเลือก O หรือ P" }]}
            extra="QA สามารถเปลี่ยนจาก O เป็น P ได้ — ถ้าเป็น P (รับเอกสาร) จะมีขั้นตอนหน่วยงาน"
          >
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              options={DOCUMENT_ACCEPTED_OPTIONS}
            />
          </Form.Item>
          {qaDocumentAccepted === "P" ? (
            <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
              <Form.Item
                name="document_scope"
                label="เอกสารภายใน/ภายนอก"
                className="!mb-3"
                rules={[{ required: true, message: "กรุณาเลือกเอกสารภายในหรือภายนอก" }]}
              >
                <DocumentScopeCheckbox />
              </Form.Item>
              <Form.Item
                name="document_no"
                label="เลขที่เอกสาร"
                className="!mb-3"
                rules={[{ required: true, message: "กรุณากรอกเลขที่เอกสาร" }]}
                extra="รันอัตโนมัติแบบ AP26-001 — แก้ไขมือได้"
              >
                <Input placeholder="AP26-001" allowClear />
              </Form.Item>
            </div>
          ) : null}
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item
              name="reported_by_department_name"
              label="หน่วยงานที่แจ้งปัญหา"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณาเลือกหน่วยงานที่แจ้งปัญหา" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือกหน่วยงาน"
                options={mergedOptions.reported_by_department_name || []}
              />
            </Form.Item>
            <Form.Item
              name="responsible_department_name"
              label="หน่วยงานที่รับผิดชอบ"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณาเลือกหน่วยงานที่รับผิดชอบ" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="เลือกหน่วยงาน"
                options={mergedOptions.responsible_department_name || []}
              />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Modal
        title={`กรอกข้อมูล Complaint · ${responsibleName}`}
        open={deptModalOpen}
        onCancel={() => !saving && setDeptModalOpen(false)}
        destroyOnHidden
        width={1100}
        centered
        styles={{ body: { paddingTop: 8, paddingBottom: 4 } }}
        footer={[
          <Button key="cancel" disabled={saving} onClick={() => setDeptModalOpen(false)}>
            ยกเลิก
          </Button>,
          <Button
            key="save"
            loading={saving}
            onClick={() => submitDepartment("save")}
          >
            บันทึกร่าง
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving}
            onClick={() => submitDepartment("submit")}
          >
            บันทึกและส่งต่อ QA Confirm
          </Button>,
        ]}
      >
        <Alert
          className="!mb-2"
          type="info"
          showIcon
          message={`PDR: ${record.pdr_no || "-"}`}
        />
        <Form form={deptForm} layout="vertical" className="complaint-dept-modal-form">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item label="วันที่ส่งต่อเอกสาร" className="!mb-2">
              <Input value={formatDate(record.doc_forward_date)} readOnly />
            </Form.Item>
            <Form.Item label="ผู้รับเอกสาร" className="!mb-2">
              <Input value={record.doc_receiver || "-"} readOnly />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item label="วันที่รับเอกสารตอบกลับ" className="!mb-2">
              <Input value={formatDate(record.doc_reply_date)} readOnly />
            </Form.Item>
            <Form.Item label="วันที่ส่งเอกสาร CS&Sale" className="!mb-2">
              <Input value={formatDate(record.doc_cs_sale_date)} readOnly />
            </Form.Item>
            <Form.Item label="Lead time (วัน)" className="!mb-2">
              <Input
                value={
                  record.lead_time_days == null || record.lead_time_days === ""
                    ? "-"
                    : String(record.lead_time_days)
                }
                readOnly
              />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item
              name="cause"
              label="สาเหตุ"
              className="!mb-2"
              rules={[{ required: true, message: "กรุณากรอกสาเหตุ" }]}
            >
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
            <Form.Item
              name="correction"
              label="แก้ไข"
              className="!mb-2"
              rules={[{ required: true, message: "กรุณากรอกการแก้ไข" }]}
            >
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
            <Form.Item
              name="prevention"
              label="ป้องกัน"
              className="!mb-2"
              rules={[{ required: true, message: "กรุณากรอกการป้องกัน" }]}
            >
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
          </div>
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-2">
            <Form.Item name="completed_date" label="วันที่แก้ไขแล้วเสร็จ" className="!mb-2">
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item>
            <Form.Item name="remark" label="หมายเหตุ" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 1, maxRows: 2 }} />
            </Form.Item>
          </div>
          <Form.Item
            label="รูปภาพหรือไฟล์แนบ"
            className="!mb-0"
            extra="สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB"
          >
            <Upload.Dragger
              multiple
              maxCount={10}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={({ fileList: next }) => setFileList(next)}
              style={{ padding: "2px 0" }}
              className="!py-1"
            >
              <p className="ant-upload-drag-icon !mb-0 !mt-1">
                <UploadOutlined />
              </p>
              <p className="ant-upload-text !mb-1 !text-sm">คลิกหรือลากไฟล์มาวางที่นี่</p>
            </Upload.Dragger>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="แก้ไขสาเหตุ / แก้ไข / ป้องกัน · QA Confirm"
        open={qaConfirmModalOpen}
        onCancel={() => !saving && setQaConfirmModalOpen(false)}
        destroyOnHidden
        width={1100}
        centered
        styles={{ body: { paddingTop: 8, paddingBottom: 4 } }}
        footer={[
          <Button key="cancel" disabled={saving} onClick={() => setQaConfirmModalOpen(false)}>
            ยกเลิก
          </Button>,
          <Button
            key="save"
            type="primary"
            loading={saving}
            onClick={saveQaConfirmEdits}
          >
            บันทึกการแก้ไข
          </Button>,
        ]}
      >
        <Alert
          className="!mb-2"
          type="info"
          showIcon
          message={`PDR: ${record.pdr_no || "-"} — แก้ไขได้ถ้าต้องการ จากนั้นกด Confirm เพื่อปิดงาน`}
        />
        <Form form={qaConfirmForm} layout="vertical">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item name="cause" label="สาเหตุ" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
            <Form.Item name="correction" label="แก้ไข" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
            <Form.Item name="prevention" label="ป้องกัน" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 5, maxRows: 8 }} />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="หมายเหตุ" className="!mb-0">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} />
          </Form.Item>
        </Form>
      </Modal>
    </Form>
  );
}
