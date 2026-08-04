import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Form,
  Image,
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
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
  PaperClipOutlined,
  PlusOutlined,
  UploadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useSession } from "../../hooks/useSession";
import { complaintApi } from "../../services/api";
import { formatDate } from "../../utils/datetime";
import { compressUploadFileList } from "../../utils/compressImage";
import {
  canCsWork,
  canDepartmentWork,
  canQaWork,
  isCmsAdmin,
} from "../../utils/authz";
import {
  ActionPlanDocument,
  canShowActionPlanDocument,
} from "./ActionPlanDocument";

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
  { value: "P", label: "รับเอกสาร" },
  { value: "O", label: "ไม่รับเอกสาร" },
];

function formatDocumentAccepted(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code === "P") return "รับเอกสาร";
  if (code === "O") return "ไม่รับเอกสาร";
  if (!code) return "-";
  return String(value);
}

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
  return canCsWork(user);
}

function isQaUser(user) {
  return canQaWork(user);
}

function normalizeDeptName(value) {
  return String(value || "").trim().toUpperCase();
}

function isResponsibleDepartmentUser(user, record) {
  if (isCmsAdmin(user)) return true;
  if (!canDepartmentWork(user)) return false;
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
  if (isCmsAdmin(user)) return status !== "completed";
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
      ["document_accepted", "เอกสาร Action plan", "select", "cs"],
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
  if (isCmsAdmin(user)) return activeGroup;
  if (canCsWork(user)) return "cs";
  if (canQaWork(user)) return "qa";
  if (canDepartmentWork(user) || user?.department) return "department";
  return null;
}

function FieldLabel({ label, required }) {
  return (
    <span>
      {label}
      {required ? <span className="ml-1 font-semibold text-red-600">*</span> : null}
    </span>
  );
}

function displayValue(value, type, name) {
  if (name === "document_accepted") return formatDocumentAccepted(value);
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

function getUploadPreviewUrl(file) {
  if (!file) return null;
  if (file.thumbUrl) return file.thumbUrl;
  if (file.url) {
    return String(file.url).includes("?") ? `${file.url}&inline=1` : `${file.url}?inline=1`;
  }
  const raw = file.originFileObj || file;
  if (raw instanceof Blob) return URL.createObjectURL(raw);
  return null;
}

/** Compact modern signature picker — solid border, small icon, image cover when set. */
function SignatureUploadBox({ fileList = [], onChange, size = 40 }) {
  const file = fileList[0] || null;
  const previewUrl = getUploadPreviewUrl(file);
  const boxStyle = { width: size, height: size };

  const uploadProps = {
    accept: "image/*",
    maxCount: 1,
    showUploadList: false,
    beforeUpload: () => false,
    fileList,
    onChange: ({ fileList: next }) => onChange?.(next.slice(-1)),
  };

  if (file && previewUrl) {
    return (
      <div
        className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white"
        style={boxStyle}
      >
        <img
          src={previewUrl}
          alt={file.name || "ลายเซ็น"}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 flex items-center justify-center gap-0.5 bg-black/45 opacity-0 transition group-hover:opacity-100">
          <Upload {...uploadProps}>
            <button
              type="button"
              className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-slate-700"
              title="เปลี่ยน"
            >
              <UploadOutlined className="text-xs" />
            </button>
          </Upload>
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-white text-red-600"
            title="ลบ"
            onClick={() => onChange?.([])}
          >
            <DeleteOutlined className="text-xs" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Upload {...uploadProps} className="!block">
      <button
        type="button"
        style={boxStyle}
        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:border-red-300 hover:bg-red-50/40 hover:text-red-600"
        title="อัปโหลดลายเซ็น"
      >
        <UploadOutlined className={size >= 48 ? "text-base" : "text-sm"} />
      </button>
    </Upload>
  );
}

const PLAN_CONTRIBUTOR_DEFAULT = 2;
const PLAN_CONTRIBUTOR_MAX = 10;
const PLAN_APPROVAL_ROLES = [
  { key: "production_specialist", label: "ผู้เชี่ยวชาญการผลิต" },
  { key: "qa_deputy", label: "รองผู้จัดการฝ่ายประกันคุณภาพ" },
];

function emptyContributorRow() {
  return { name: "", position: "" };
}

function emptyPlanFormState(count = PLAN_CONTRIBUTOR_DEFAULT) {
  const size = Math.min(PLAN_CONTRIBUTOR_MAX, Math.max(1, count));
  return {
    contributors: Array.from({ length: size }, () => emptyContributorRow()),
  };
}

function normalizePlanFormState(raw) {
  if (!raw) return emptyPlanFormState();
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return emptyPlanFormState();
    }
  }
  const contributors = Array.isArray(parsed?.contributors) ? parsed.contributors : [];
  if (!contributors.length) return emptyPlanFormState();
  return {
    contributors: contributors.slice(0, PLAN_CONTRIBUTOR_MAX).map((row) => ({
      name: String(row?.name || "").trim(),
      position: String(row?.position || "").trim(),
    })),
  };
}

function attachmentById(attachments, id) {
  if (!id) return null;
  return (attachments || []).find((item) => Number(item.id) === Number(id)) || null;
}

function parsePlanFormRaw(raw) {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  return parsed;
}

function collectPlanSignatureIds(raw) {
  const parsed = parsePlanFormRaw(raw);
  if (!parsed) return new Set();
  const ids = new Set();
  for (const row of parsed.contributors || []) {
    const id = Number(row?.signatureId);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  for (const role of PLAN_APPROVAL_ROLES) {
    const id = Number(parsed?.approvals?.[role.key]?.signatureId);
    if (Number.isInteger(id) && id > 0) ids.add(id);
  }
  return ids;
}

function planSignatureListsFromRecord(record) {
  const parsed = parsePlanFormRaw(record?.plan_form_json);
  const attachments = record?.attachments || [];
  const rows = Array.isArray(parsed?.contributors) ? parsed.contributors : [];
  const contributorCount = Math.max(rows.length, PLAN_CONTRIBUTOR_DEFAULT);
  const contributorSigs = Array.from({ length: contributorCount }, (_, index) => {
    const id = rows[index]?.signatureId;
    const attachment = attachmentById(attachments, id);
    return attachment ? toUploadFileList([attachment]) : [];
  }).slice(0, PLAN_CONTRIBUTOR_MAX);
  const approvalSigs = {};
  for (const role of PLAN_APPROVAL_ROLES) {
    const id = parsed?.approvals?.[role.key]?.signatureId;
    const attachment = attachmentById(attachments, id);
    approvalSigs[role.key] = attachment ? toUploadFileList([attachment]) : [];
  }
  return { contributorSigs, approvalSigs };
}

function PlanContributorsView({ record }) {
  const parsed = parsePlanFormRaw(record?.plan_form_json);
  const attachments = record?.attachments || [];
  const displayRows = (Array.isArray(parsed?.contributors) ? parsed.contributors : [])
    .slice(0, PLAN_CONTRIBUTOR_MAX)
    .filter(
      (row) =>
        String(row?.name || "").trim() ||
        String(row?.position || "").trim() ||
        row?.signatureId,
    );

  if (!displayRows.length && !PLAN_APPROVAL_ROLES.some((role) => parsed?.approvals?.[role.key]?.signatureId)) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
        ยังไม่มีข้อมูลผู้ร่วมจัดทำแผน
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto flex min-w-[640px] max-w-4xl overflow-hidden rounded border border-slate-400 bg-white">
        <table className="w-full min-w-0 flex-1 border-collapse text-sm">
          <thead>
            <tr>
              <th
                colSpan={3}
                className="border-b border-slate-400 bg-slate-50 px-2 py-2 text-center text-sm font-semibold text-slate-800"
              >
                ผู้ร่วมจัดทำแผน
              </th>
            </tr>
            <tr className="bg-white text-xs font-medium text-slate-600">
              <th className="w-[42%] border-b border-r border-slate-400 px-2 py-1.5 text-left font-medium">
                ชื่อ - สกุล
              </th>
              <th className="w-[38%] border-b border-r border-slate-400 px-2 py-1.5 text-left font-medium">
                ตำแหน่ง
              </th>
              <th className="w-[20%] border-b border-slate-400 px-2 py-1.5 text-center font-medium">
                ลงชื่อ
              </th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, index) => {
              const attachment = attachmentById(attachments, row?.signatureId);
              const isLast = index === displayRows.length - 1;
              return (
                <tr key={`plan-view-row-${index}`}>
                  <td
                    className={`border-r border-slate-400 px-2 py-1.5 align-middle text-slate-800 ${
                      isLast ? "" : "border-b"
                    }`}
                  >
                    {row?.name || "\u00a0"}
                  </td>
                  <td
                    className={`border-r border-slate-400 px-2 py-1.5 align-middle text-slate-800 ${
                      isLast ? "" : "border-b"
                    }`}
                  >
                    {row?.position || "\u00a0"}
                  </td>
                  <td
                    className={`px-1 py-1 align-middle ${isLast ? "" : "border-b border-slate-400"}`}
                  >
                    <div className="mx-auto flex h-14 w-full max-w-[110px] items-center justify-center">
                      {attachment ? (
                        <Image
                          src={`${attachment.url}?inline=1`}
                          alt={row?.name || "ลายเซ็น"}
                          className="!h-full !w-full object-contain"
                          rootClassName="h-full w-full [&_.ant-image-img]:h-full [&_.ant-image-img]:w-full [&_.ant-image-img]:object-contain"
                          preview={{ mask: "ดูภาพ" }}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="flex w-[200px] shrink-0 flex-col border-l border-slate-400">
          {PLAN_APPROVAL_ROLES.map((role, index) => {
            const attachment = attachmentById(
              attachments,
              parsed?.approvals?.[role.key]?.signatureId,
            );
            return (
              <div
                key={role.key}
                className={`flex flex-1 flex-col items-center justify-end px-3 py-3 ${
                  index === 0 ? "border-b border-slate-400" : ""
                }`}
              >
                <div className="mb-2 flex h-16 w-full items-center justify-center">
                  {attachment ? (
                    <Image
                      src={`${attachment.url}?inline=1`}
                      alt={role.label}
                      className="!h-full !w-full object-contain"
                      rootClassName="h-full w-full [&_.ant-image-img]:h-full [&_.ant-image-img]:w-full [&_.ant-image-img]:object-contain"
                      preview={{ mask: "ดูภาพ" }}
                    />
                  ) : (
                    <div className="h-10 w-full" />
                  )}
                </div>
                <div className="w-full border-t border-dotted border-slate-500 pt-1.5 text-center text-[11px] leading-snug text-slate-700">
                  {role.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PlanContributorsForm({
  planForm,
  onPlanFormChange,
  contributorSigs,
  onContributorSigsChange,
  approvalSigs,
  onApprovalSigsChange,
}) {
  const canAdd = planForm.contributors.length < PLAN_CONTRIBUTOR_MAX;
  const canRemove = planForm.contributors.length > 1;

  const updateContributor = (index, key, value) => {
    onPlanFormChange({
      ...planForm,
      contributors: planForm.contributors.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    });
  };

  const addContributor = () => {
    if (!canAdd) return;
    onPlanFormChange({
      ...planForm,
      contributors: [...planForm.contributors, emptyContributorRow()],
    });
    onContributorSigsChange([...(contributorSigs || []), []]);
  };

  const removeContributor = (index) => {
    if (!canRemove) return;
    onPlanFormChange({
      ...planForm,
      contributors: planForm.contributors.filter((_, rowIndex) => rowIndex !== index),
    });
    onContributorSigsChange(
      (contributorSigs || []).filter((_, rowIndex) => rowIndex !== index),
    );
  };

  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-2 lg:grid-cols-[minmax(0,1fr)_168px]">
      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <div className="text-sm text-slate-800">ผู้ร่วมจัดทำแผน</div>
          <Button
            type="link"
            size="small"
            className="!px-0"
            icon={<PlusOutlined />}
            disabled={!canAdd}
            onClick={addContributor}
          >
            เพิ่ม
          </Button>
        </div>

        <div className="overflow-hidden rounded-lg border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_88px_28px] gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
            <div>ชื่อ - สกุล</div>
            <div>ตำแหน่ง</div>
            <div className="text-center">ลงชื่อ</div>
            <div />
          </div>
          {planForm.contributors.map((row, index) => (
            <div
              key={`contributor-${index}`}
              className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_88px_28px] items-center gap-2 border-b border-slate-100 px-2 py-1.5 last:border-b-0"
            >
              <Input
                size="middle"
                value={row.name}
                placeholder="ชื่อ - สกุล"
                onChange={(event) => updateContributor(index, "name", event.target.value)}
              />
              <Input
                size="middle"
                value={row.position}
                placeholder="ตำแหน่ง"
                onChange={(event) => updateContributor(index, "position", event.target.value)}
              />
              <div className="flex justify-center py-0.5">
                <SignatureUploadBox
                  size={80}
                  fileList={contributorSigs[index] || []}
                  onChange={(next) => {
                    const lists = [...(contributorSigs || [])];
                    while (lists.length <= index) lists.push([]);
                    lists[index] = next;
                    onContributorSigsChange(lists);
                  }}
                />
              </div>
              <Button
                type="text"
                danger
                size="small"
                className="!px-0"
                icon={<MinusOutlined />}
                disabled={!canRemove}
                title="ลบรายชื่อ"
                onClick={() => removeContributor(index)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-1 text-sm text-slate-800">ลายเซ็นผู้อนุมัติ</div>
        <div className="space-y-2">
          {PLAN_APPROVAL_ROLES.map((role) => (
            <div key={role.key} className="rounded-lg border border-slate-200 px-2 py-2">
              <div className="mb-1.5 text-center text-[11px] leading-tight text-slate-500">
                {role.label}
              </div>
              <div className="flex justify-center">
                <SignatureUploadBox
                  size={80}
                  fileList={approvalSigs[role.key] || []}
                  onChange={(next) =>
                    onApprovalSigsChange({ ...approvalSigs, [role.key]: next })
                  }
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PDF_IMAGE_SLOT_OPTIONS = [
  { value: "picture", label: "Picture (รูปภาพ)" },
  { value: "cause", label: "สาเหตุ" },
  { value: "correction", label: "แก้ไข" },
  { value: "prevention", label: "แนวทางป้องกัน" },
  { value: "none", label: "ไม่ใส่ใน PDF" },
];

function parsePdfImageSlots(raw) {
  const parsed = parsePlanFormRaw(raw);
  const slots = parsed?.pdfImageSlots || parsed?.pdf_image_slots || {};
  if (!slots || typeof slots !== "object") return {};
  const out = {};
  for (const [key, value] of Object.entries(slots)) {
    const id = Number(key);
    if (!Number.isInteger(id) || id <= 0) continue;
    out[String(id)] = String(value || "");
  }
  return out;
}

function AttachmentGallery({ attachments = [], emptyText = "ยังไม่มีไฟล์แนบ" }) {
  if (!attachments.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {attachments.map((attachment) => {
        const isImage = String(attachment.mime_type || "").startsWith("image/");
        const meta = (
          <div className="p-3">
            <div className="truncate text-sm font-medium">{attachment.original_name}</div>
            <div className="mt-1 text-xs text-slate-400">
              {formatFileSize(attachment.file_size)}
              {attachment.uploaded_by_name ? ` · ${attachment.uploaded_by_name}` : ""}
            </div>
          </div>
        );
        if (isImage) {
          return (
            <div
              key={attachment.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-red-300 hover:shadow-sm"
            >
              <Image
                src={`${attachment.url}?inline=1`}
                alt={attachment.original_name}
                className="!h-32 !w-full bg-slate-50 object-contain"
                rootClassName="block w-full [&_.ant-image-img]:h-32 [&_.ant-image-img]:w-full [&_.ant-image-img]:bg-slate-50 [&_.ant-image-img]:object-contain"
                preview={{ mask: "ดูภาพ" }}
              />
              {meta}
            </div>
          );
        }
        return (
          <a
            key={attachment.id}
            href={attachment.url}
            target="_blank"
            rel="noreferrer"
            className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-red-300 hover:shadow-sm"
          >
            <div className="flex h-24 items-center justify-center bg-slate-50 text-3xl text-slate-400">
              <PaperClipOutlined />
            </div>
            {meta}
          </a>
        );
      })}
    </div>
  );
}

/** Compact image + PDF slot picker for QA Confirm modal. */
function QaPdfImageAssigner({
  attachments = [],
  pdfImageSlots = {},
  onPdfSlotChange,
  fileList = [],
  onFileListChange,
  newFileSlots = {},
  onNewFileSlotChange,
  disabled = false,
}) {
  const previewUrl = (file) => {
    if (file.thumbUrl) return file.thumbUrl;
    if (file.url) return file.url.includes("inline=") ? file.url : `${file.url}?inline=1`;
    return null;
  };

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div>
        <div className="text-sm font-semibold text-slate-800">เลือกรูปใส่ใน PDF</div>
        <div className="mt-0.5 text-xs text-slate-500">
          เลือกช่อง Picture / สาเหตุ / แก้ไข / แนวทางป้องกัน — ช่องละสูงสุด 3 รูป
        </div>
      </div>

      {attachments.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attachments.map((attachment) => {
            const slotValue =
              pdfImageSlots[String(attachment.id)] ||
              pdfImageSlots[attachment.id] ||
              "picture";
            return (
              <div
                key={attachment.id}
                className="flex gap-2 rounded-lg border border-slate-200 bg-white p-1.5 shadow-sm"
              >
                <Image
                  src={`${attachment.url}?inline=1`}
                  alt={attachment.original_name}
                  className="!h-12 !w-14 rounded object-cover"
                  rootClassName="shrink-0 [&_.ant-image-img]:h-12 [&_.ant-image-img]:w-14 [&_.ant-image-img]:rounded [&_.ant-image-img]:object-cover"
                  preview={{ mask: "ดู" }}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-slate-700">
                    {attachment.original_name}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {formatFileSize(attachment.file_size)}
                  </div>
                  <Select
                    className="mt-1 w-full"
                    size="small"
                    disabled={disabled}
                    value={slotValue}
                    options={PDF_IMAGE_SLOT_OPTIONS}
                    onChange={(value) => onPdfSlotChange?.(attachment.id, value)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-3 text-center text-xs text-slate-400">
          ยังไม่มีรูป — อัปโหลดด้านล่างได้
        </div>
      )}

      {fileList.length ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {fileList.map((file) => {
            const src = previewUrl(file);
            const isImage = String(file.type || "").startsWith("image/");
            const slotValue = newFileSlots[file.uid] || "picture";
            return (
              <div
                key={file.uid}
                className="flex gap-2 rounded-lg border border-dashed border-red-200 bg-white p-1.5"
              >
                {src ? (
                  <img
                    src={src}
                    alt={file.name}
                    className="h-12 w-14 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-14 shrink-0 items-center justify-center rounded bg-slate-100 text-slate-400">
                    <PaperClipOutlined />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-medium text-slate-700">{file.name}</div>
                      <div className="text-[10px] text-emerald-600">ไฟล์ใหม่</div>
                    </div>
                    <Button
                      type="text"
                      size="small"
                      danger
                      className="!h-5 !min-w-0 !px-1"
                      disabled={disabled}
                      onClick={() =>
                        onFileListChange?.(fileList.filter((item) => item.uid !== file.uid))
                      }
                    >
                      <DeleteOutlined className="text-xs" />
                    </Button>
                  </div>
                  {isImage ? (
                    <Select
                      className="mt-1 w-full"
                      size="small"
                      disabled={disabled}
                      value={slotValue}
                      options={PDF_IMAGE_SLOT_OPTIONS}
                      onChange={(value) => onNewFileSlotChange?.(file.uid, value)}
                    />
                  ) : (
                    <div className="mt-1 text-[10px] text-slate-400">แนบไฟล์ (ไม่ใส่ PDF)</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <Upload.Dragger
        multiple
        maxCount={10}
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"
        beforeUpload={() => false}
        fileList={fileList}
        showUploadList={false}
        disabled={disabled}
        onChange={({ fileList: next }) => onFileListChange?.(next)}
        className="!border-slate-300 !bg-white"
      >
        <p className="ant-upload-drag-icon !mb-1 !mt-1">
          <UploadOutlined className="!text-slate-400" />
        </p>
        <p className="ant-upload-text !mb-0 !text-sm !text-slate-600">
          คลิกหรือลากไฟล์/รูปมาวางเพื่อเพิ่ม
        </p>
        <p className="ant-upload-hint !mb-1 !text-xs !text-slate-400">
          รูปจะถูกบีบอัดอัตโนมัติ · สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB
        </p>
      </Upload.Dragger>
    </div>
  );
}

function splitAttachments(attachments = [], excludeIds = null) {
  const files = [];
  const signatures = [];
  const excluded = excludeIds instanceof Set ? excludeIds : null;
  for (const attachment of attachments) {
    if (excluded?.has(Number(attachment.id))) continue;
    if (String(attachment.kind || "file") === "signature") signatures.push(attachment);
    else files.push(attachment);
  }
  return { files, signatures };
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

function collectRemovedAttachmentIds(fileList, existingAttachments = []) {
  const retainedIds = new Set(
    fileList
      .filter((item) => item.attachmentId)
      .map((item) => Number(item.attachmentId)),
  );
  return existingAttachments
    .map((attachment) => Number(attachment.id))
    .filter((id) => !retainedIds.has(id));
}

function appendUploadFiles(data, fileList, fieldName = "files") {
  for (const item of fileList.filter((file) => !file.attachmentId)) {
    data.append(fieldName, item.originFileObj || item);
  }
}

async function withCompressedUploadList(fileList) {
  return compressUploadFileList(fileList || []);
}

function buildAttachmentFormData(data, fileList, existingAttachments = []) {
  data.append(
    "remove_attachment_ids",
    JSON.stringify(collectRemovedAttachmentIds(fileList, existingAttachments)),
  );
  appendUploadFiles(data, fileList, "files");
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
  const value = displayValue(record?.[name], type, name);
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
  const [signatureFileList, setSignatureFileList] = useState([]);
  const [planForm, setPlanForm] = useState(() => emptyPlanFormState());
  const [planContributorSigs, setPlanContributorSigs] = useState(() =>
    Array.from({ length: PLAN_CONTRIBUTOR_DEFAULT }, () => []),
  );
  const [planApprovalSigs, setPlanApprovalSigs] = useState(() => ({
    production_specialist: [],
    qa_deputy: [],
  }));
  const [modalPdfImageSlots, setModalPdfImageSlots] = useState({});
  const [qaConfirmFileList, setQaConfirmFileList] = useState([]);
  const [qaConfirmNewFileSlots, setQaConfirmNewFileSlots] = useState({});
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
  const documentAcceptedP = String(record?.document_accepted || "").toUpperCase() === "P";
  const qaConfirmImageFiles = useMemo(() => {
    const planSigIds = collectPlanSignatureIds(record?.plan_form_json);
    return splitAttachments(record?.attachments || [], planSigIds).files.filter((item) =>
      String(item.mime_type || "").startsWith("image/"),
    );
  }, [record?.attachments, record?.plan_form_json]);

  useEffect(() => {
    setCsModalOpen(false);
    setQaModalOpen(false);
    setDeptModalOpen(false);
    setQaConfirmModalOpen(false);
    setFileList([]);
    setSignatureFileList([]);
    setPlanForm(emptyPlanFormState());
    setPlanContributorSigs(Array.from({ length: PLAN_CONTRIBUTOR_DEFAULT }, () => []));
    setPlanApprovalSigs({ production_specialist: [], qa_deputy: [] });
    setModalPdfImageSlots({});
    setQaConfirmFileList([]);
    setQaConfirmNewFileSlots({});
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
      if (canShowActionPlanDocument(result.data)) {
        setTimeout(() => {
          document
            .getElementById("action-plan-document")
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
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
    const existing = parsePdfImageSlots(record.plan_form_json);
    const initial = { ...existing };
    if (!Object.keys(initial).length) {
      for (const file of qaConfirmImageFiles) {
        initial[String(file.id)] = "picture";
      }
    }
    setModalPdfImageSlots(initial);
    setQaConfirmFileList([]);
    setQaConfirmNewFileSlots({});
    setQaConfirmModalOpen(true);
  };

  const saveQaConfirmEdits = async () => {
    try {
      const values = await qaConfirmForm.validateFields();
      setSaving(true);

      if (documentAcceptedP) {
        const data = new FormData();
        data.append("cause", values.cause || "");
        data.append("correction", values.correction || "");
        data.append("prevention", values.prevention || "");
        data.append("remark", values.remark || "");
        data.append("pdf_image_slots", JSON.stringify(modalPdfImageSlots || {}));
        data.append(
          "new_file_slots",
          JSON.stringify(
            qaConfirmFileList.map((file) => {
              if (!String(file.type || "").startsWith("image/")) return "none";
              return qaConfirmNewFileSlots[file.uid] || "picture";
            }),
          ),
        );
        data.append("remove_attachment_ids", JSON.stringify([]));
        appendUploadFiles(data, qaConfirmFileList, "files");
        const result = await complaintApi.saveQaConfirm(record.id, data);
        message.success("บันทึกการแก้ไขแล้ว");
        setQaConfirmModalOpen(false);
        setQaConfirmFileList([]);
        setQaConfirmNewFileSlots({});
        onSaved?.(result.data);
      } else {
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
      }
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
    setFileList(toUploadFileList(splitAttachments(record.attachments || []).files));
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
      buildAttachmentFormData(
        data,
        fileList,
        splitAttachments(record.attachments || []).files,
      );
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
    const planSigIds = collectPlanSignatureIds(latest.plan_form_json);
    const split = splitAttachments(latest.attachments || [], planSigIds);
    setFileList(toUploadFileList(split.files));
    setSignatureFileList(toUploadFileList(split.signatures));
    setPlanForm(normalizePlanFormState(latest.plan_form_json));
    const planSigs = planSignatureListsFromRecord(latest);
    setPlanContributorSigs(planSigs.contributorSigs);
    setPlanApprovalSigs(planSigs.approvalSigs);
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
      const planSigIds = collectPlanSignatureIds(record.plan_form_json);
      const split = splitAttachments(record.attachments || [], planSigIds);
      const removedIds = [
        ...collectRemovedAttachmentIds(fileList, split.files),
        ...collectRemovedAttachmentIds(signatureFileList, split.signatures),
      ];
      data.append("remove_attachment_ids", JSON.stringify(removedIds));
      appendUploadFiles(data, fileList, "files");
      appendUploadFiles(data, signatureFileList, "signatures");

      const planPayload = {
        contributors: planForm.contributors.map((row, index) => ({
          name: row.name,
          position: row.position,
          signatureId: planContributorSigs[index]?.[0]?.attachmentId || null,
        })),
        approvals: {
          production_specialist: {
            signatureId: planApprovalSigs.production_specialist?.[0]?.attachmentId || null,
          },
          qa_deputy: {
            signatureId: planApprovalSigs.qa_deputy?.[0]?.attachmentId || null,
          },
        },
      };
      data.append("plan_form", JSON.stringify(planPayload));
      planContributorSigs.forEach((list, index) => {
        const file = list?.[0];
        if (file && !file.attachmentId) {
          data.append(`plan_sig_contributor_${index}`, file.originFileObj || file);
        }
      });
      for (const role of PLAN_APPROVAL_ROLES) {
        const file = planApprovalSigs[role.key]?.[0];
        if (file && !file.attachmentId) {
          const field =
            role.key === "production_specialist"
              ? "plan_sig_approval_production"
              : "plan_sig_approval_qa";
          data.append(field, file.originFileObj || file);
        }
      }

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
        setSignatureFileList([]);
        setPlanForm(emptyPlanFormState());
        setPlanContributorSigs(Array.from({ length: PLAN_CONTRIBUTOR_DEFAULT }, () => []));
        setPlanApprovalSigs({ production_specialist: [], qa_deputy: [] });
      } else {
        const nextPlanSigIds = collectPlanSignatureIds(result.data?.plan_form_json);
        const nextSplit = splitAttachments(result.data?.attachments || [], nextPlanSigIds);
        setFileList(toUploadFileList(nextSplit.files));
        setSignatureFileList(toUploadFileList(nextSplit.signatures));
        setPlanForm(normalizePlanFormState(result.data?.plan_form_json));
        const planSigs = planSignatureListsFromRecord(result.data || {});
        setPlanContributorSigs(planSigs.contributorSigs);
        setPlanApprovalSigs(planSigs.approvalSigs);
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
            description={
              canShowActionPlanDocument(record)
                ? "เอกสาร Action Plan พร้อมดาวน์โหลดด้านล่างสุดของหน้านี้"
                : undefined
            }
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
                (() => {
                  const planSigIds = collectPlanSignatureIds(record.plan_form_json);
                  const split = splitAttachments(record.attachments || [], planSigIds);
                  return (
                    <div className="mt-2 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
                      <div className={split.signatures.length ? "" : "sm:col-span-2"}>
                        <Typography.Title level={5} className="!mb-3">
                          รูปภาพหรือไฟล์แนบ
                        </Typography.Title>
                        <AttachmentGallery attachments={split.files} />
                      </div>
                      {split.signatures.length ? (
                        <div>
                          <Typography.Title level={5} className="!mb-3">
                            ลายเซ็น
                          </Typography.Title>
                          <AttachmentGallery
                            attachments={split.signatures}
                            emptyText="ยังไม่มีลายเซ็น"
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })()
              ) : null}
            </Card>
          );
        })}
        <Card size="small" title={<Typography.Text>ผู้ร่วมจัดทำแผน / ลายเซ็นผู้อนุมัติ</Typography.Text>}>
          <PlanContributorsView record={record} />
        </Card>
        {canShowActionPlanDocument(record) ? (
          <ActionPlanDocument record={record} />
        ) : null}
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
              label="เอกสาร Action plan"
              className="!mb-3"
              rules={[{ required: true, message: "กรุณาเลือกรับหรือไม่รับเอกสาร" }]}
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
            extra="รูปจะถูกบีบอัดอัตโนมัติ · สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB"
          >
            <Upload.Dragger
              multiple
              maxCount={10}
              beforeUpload={() => false}
              fileList={fileList}
              onChange={async ({ fileList: next }) => {
                setFileList(await withCompressedUploadList(next));
              }}
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
            label="เอกสาร Action plan"
            className="!mb-3"
            rules={[{ required: true, message: "กรุณาเลือกรับหรือไม่รับเอกสาร" }]}
            extra="QA สามารถเปลี่ยนจากไม่รับเป็นรับได้ — ถ้ารับเอกสาร จะมีขั้นตอนหน่วยงาน"
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
        width={1200}
        centered
        styles={{ body: { paddingTop: 8, paddingBottom: 4, maxHeight: "75vh", overflowY: "auto" } }}
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
          <div className="grid grid-cols-1 gap-x-4">
            <Form.Item
              label="รูปภาพหรือไฟล์แนบ"
              className="!mb-3"
              extra="รูปจะถูกบีบอัดอัตโนมัติ · สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB"
            >
              <Upload.Dragger
                multiple
                maxCount={10}
                beforeUpload={() => false}
                fileList={fileList}
                onChange={async ({ fileList: next }) => {
                  setFileList(await withCompressedUploadList(next));
                }}
                style={{ padding: "2px 0" }}
                className="!py-1"
              >
                <p className="ant-upload-drag-icon !mb-0 !mt-1">
                  <UploadOutlined />
                </p>
                <p className="ant-upload-text !mb-1 !text-sm">คลิกหรือลากไฟล์มาวางที่นี่</p>
              </Upload.Dragger>
            </Form.Item>
          </div>
          <div className="!mb-0">
            <PlanContributorsForm
              planForm={planForm}
              onPlanFormChange={setPlanForm}
              contributorSigs={planContributorSigs}
              onContributorSigsChange={setPlanContributorSigs}
              approvalSigs={planApprovalSigs}
              onApprovalSigsChange={setPlanApprovalSigs}
            />
          </div>
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
          <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-3">
            <Form.Item name="cause" label="สาเหตุ" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="สาเหตุ" />
            </Form.Item>
            <Form.Item name="correction" label="แก้ไข" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="แก้ไข" />
            </Form.Item>
            <Form.Item name="prevention" label="ป้องกัน" className="!mb-2">
              <Input.TextArea autoSize={{ minRows: 3, maxRows: 6 }} placeholder="ป้องกัน" />
            </Form.Item>
          </div>
          <Form.Item name="remark" label="หมายเหตุ" className="!mb-3">
            <Input.TextArea autoSize={{ minRows: 2, maxRows: 3 }} placeholder="หมายเหตุ" />
          </Form.Item>
          {documentAcceptedP ? (
            <QaPdfImageAssigner
              attachments={qaConfirmImageFiles}
              pdfImageSlots={modalPdfImageSlots}
              onPdfSlotChange={(attachmentId, slot) => {
                setModalPdfImageSlots((prev) => ({
                  ...prev,
                  [String(attachmentId)]: slot,
                }));
              }}
              fileList={qaConfirmFileList}
              onFileListChange={async (next) => {
                const compressed = await withCompressedUploadList(next);
                setQaConfirmFileList(compressed);
                setQaConfirmNewFileSlots((prev) => {
                  const nextSlots = { ...prev };
                  for (const file of compressed) {
                    if (!nextSlots[file.uid]) nextSlots[file.uid] = "picture";
                  }
                  for (const uid of Object.keys(nextSlots)) {
                    if (!compressed.some((file) => file.uid === uid)) delete nextSlots[uid];
                  }
                  return nextSlots;
                });
              }}
              newFileSlots={qaConfirmNewFileSlots}
              onNewFileSlotChange={(uid, slot) => {
                setQaConfirmNewFileSlots((prev) => ({ ...prev, [uid]: slot }));
              }}
              disabled={saving}
            />
          ) : null}
        </Form>
      </Modal>
    </Form>
  );
}
