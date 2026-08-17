import { Alert, Button, Form, Select, Tag } from "antd";
import { problemNamesOf, hasProblemOverlap, normalizeProblemNames } from "../../utils/problems";

const TAG_CLASS =
  "!m-0 !mr-0 max-w-full !whitespace-normal !break-words !leading-snug !px-2 !py-0.5";

export function toProblemNameList(value) {
  return normalizeProblemNames(value);
}

export const PROBLEM_SELECT_ITEM_PROPS = {
  getValueFromEvent: (next) => normalizeProblemNames(next),
  normalize: (next) => normalizeProblemNames(next),
  getValueProps: (value) => ({ value: normalizeProblemNames(value) }),
};

export function ProblemChips({ names, empty = "-" }) {
  const list = normalizeProblemNames(names);
  if (!list.length) {
    return <span className="text-slate-400">{empty}</span>;
  }
  return (
    <div className="flex flex-wrap content-start gap-1.5">
      {list.map((name) => (
        <Tag key={name} className={TAG_CLASS}>
          {name}
        </Tag>
      ))}
    </div>
  );
}

/** Direct Ant Select — Form.Item must wrap this element, not a custom wrapper. */
export function ProblemSelect({
  options,
  placeholder = "เลือกได้มากกว่า 1 ปัญหา",
  className = "",
  value,
  onChange,
  ...rest
}) {
  return (
    <Select
      {...rest}
      className={["problem-multi-select", "w-full", className].filter(Boolean).join(" ")}
      mode="multiple"
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder={placeholder}
      options={options}
      listHeight={320}
      maxTagCount={undefined}
      value={normalizeProblemNames(value)}
      onChange={(next) => onChange?.(normalizeProblemNames(next))}
    />
  );
}

export function ProblemFormItem({
  name = "problem_name",
  label = "ปัญหา",
  options,
  extra = "เลือกได้มากกว่า 1 ข้อ — ช่องจะขยายตามจำนวนที่เลือก",
  required = false,
  className = "!mb-3",
  value,
  onChange,
}) {
  const select = (
    <Select
      className="problem-multi-select w-full"
      mode="multiple"
      allowClear
      showSearch
      optionFilterProp="label"
      placeholder="เลือกได้มากกว่า 1 ปัญหา"
      options={options}
      listHeight={320}
      maxTagCount={undefined}
      {...(onChange
        ? {
            value: normalizeProblemNames(value),
            onChange: (next) => onChange(normalizeProblemNames(next)),
          }
        : {})}
    />
  );

  if (onChange) {
    return (
      <Form.Item label={label} className={className} extra={extra} required={required}>
        {select}
      </Form.Item>
    );
  }

  return (
    <Form.Item
      name={name}
      label={label}
      className={className}
      extra={extra}
      {...PROBLEM_SELECT_ITEM_PROPS}
      rules={
        required
          ? [{ required: true, type: "array", min: 1, message: "กรุณาเลือกปัญหา" }]
          : undefined
      }
    >
      {select}
    </Form.Item>
  );
}

export function ProblemMismatchAlert({ complaint, relatedReject, canEdit, onEdit }) {
  if (!relatedReject) return null;
  const complaintNames = problemNamesOf(complaint);
  const rejectNames = problemNamesOf(relatedReject);
  if (!rejectNames.length) {
    return (
      <Alert
        className="!mb-3"
        type="info"
        showIcon
        message="Reject ยังไม่ได้เลือกปัญหา — ยังเทียบไม่ได้"
        description={`PDR ${relatedReject.pdr_no || complaint?.pdr_no || "-"} มีรายการ Reject แล้ว แต่ช่องปัญหายังว่าง`}
      />
    );
  }
  const overlap = complaintNames.length ? hasProblemOverlap(complaint, relatedReject) : false;
  const mismatched = Boolean(complaintNames.length && !overlap);

  return (
    <Alert
      className="problem-mismatch-alert !mb-3"
      type={mismatched ? "warning" : "info"}
      showIcon
      message={
        mismatched
          ? "ปัญหา Complaint กับ Reject ยังไม่มีข้อใดตรงกัน"
          : "ปัญหาทั้งหมดจาก Reject"
      }
      description={
        <div className="space-y-3">
          <div className="text-[13px] leading-snug text-slate-600">
            {mismatched
              ? "ไม่ต้องตรงกันทั้งหมด — มีอย่างน้อย 1 ปัญหาที่เหมือนกันก็พอ"
              : `PDR ${relatedReject.pdr_no || complaint?.pdr_no || "-"} · อ้างอิงจากใบ Reject — QA ปรับปัญหา Complaint ได้ตลอด`}
          </div>
          <ProblemCompareBox
            title="Reject"
            count={rejectNames.length}
            names={rejectNames}
            tone="reject"
          />
          {complaintNames.length ? (
            <ProblemCompareBox
              title="Complaint"
              count={complaintNames.length}
              names={complaintNames}
              tone="complaint"
            />
          ) : null}
          {canEdit && onEdit ? (
            <Button size="small" onClick={onEdit}>
              {mismatched ? "แก้ไขปัญหาให้ตรงกับ Reject" : "แก้ไขปัญหา Complaint"}
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

function ProblemCompareBox({ title, count, names, tone }) {
  const toneClass =
    tone === "reject"
      ? "border-amber-200 bg-amber-50/80"
      : "border-sky-200 bg-sky-50/70";
  return (
    <div className={`rounded-lg border px-2.5 py-2 ${toneClass}`}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-semibold text-slate-700">{title}</span>
        <span className="text-[11px] text-slate-500">{count} ข้อ</span>
      </div>
      <ProblemChips names={names} />
    </div>
  );
}
