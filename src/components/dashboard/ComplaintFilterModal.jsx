import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, Modal, Radio, Select, Space } from "antd";
import dayjs from "dayjs";

const PERIOD_OPTIONS = [
  { value: "day", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนที่แล้ว" },
  { value: "all", label: "ทั้งหมด" },
  { value: "custom", label: "กำหนดเอง" },
];

/** Each entry maps a checkbox in "ประเภทที่ต้องการกรอง" to one draft field. */
const FILTER_TYPES = [
  { key: "department", label: "หน่วยงานที่รับผิดชอบ", field: "departmentIds" },
  { key: "problem", label: "ปัญหาที่ร้องเรียน", field: "problemIds" },
  { key: "company", label: "ลูกค้า", field: "companyIds" },
  { key: "machine", label: "เครื่องจักร", field: "machineIds" },
  { key: "flute", label: "ลอนกระดาษ", field: "fluteIds" },
  { key: "grade", label: "เกรดลูกค้า", field: "grades" },
  { key: "shift", label: "กะการผลิต", field: "shifts" },
  { key: "status", label: "สถานะดำเนินการ", field: "statuses" },
];

const EMPTY_DRAFT = {
  period: "month",
  dateRange: null,
  enabledTypes: [],
  departmentIds: [],
  problemIds: [],
  companyIds: [],
  machineIds: [],
  fluteIds: [],
  grades: [],
  shifts: [],
  statuses: [],
};

export function ComplaintFilterModal({
  open,
  onClose,
  onApply,
  value,
  departmentOptions = [],
  problemOptions = [],
  companyOptions = [],
  machineOptions = [],
  fluteOptions = [],
  gradeOptions = [],
  shiftOptions = [],
  statusOptions = [],
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);

  useEffect(() => {
    if (!open) return;
    const next = {
      period: value?.period || "month",
      dateRange:
        value?.period === "custom" && value?.from && value?.to
          ? [dayjs(value.from), dayjs(value.to)]
          : null,
      departmentIds: value?.departmentIds || [],
      problemIds: value?.problemIds || [],
      companyIds: value?.companyIds || [],
      machineIds: value?.machineIds || [],
      fluteIds: value?.fluteIds || [],
      grades: value?.grades || [],
      shifts: value?.shifts || [],
      statuses: value?.statuses || [],
    };
    setDraft({
      ...next,
      enabledTypes: FILTER_TYPES.filter((item) => next[item.field]?.length).map((item) => item.key),
    });
  }, [open, value]);

  const enabledSet = useMemo(() => new Set(draft.enabledTypes), [draft.enabledTypes]);

  function patch(partial) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function handleApply() {
    const isCustom = draft.period === "custom";
    const from = isCustom ? draft.dateRange?.[0]?.format("YYYY-MM-DD") : undefined;
    const to = isCustom ? draft.dateRange?.[1]?.format("YYYY-MM-DD") : undefined;
    if (isCustom && (!from || !to)) return;

    const applied = Object.fromEntries(
      FILTER_TYPES.map((item) => [item.field, enabledSet.has(item.key) ? draft[item.field] : []]),
    );
    onApply({ period: draft.period, from, to, ...applied });
    onClose();
  }

  return (
    <Modal
      title="ตัวกรอง Dashboard Complaint"
      open={open}
      onCancel={onClose}
      width={680}
      destroyOnHidden
      centered
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button onClick={() => setDraft({ ...EMPTY_DRAFT })}>ล้างตัวกรอง</Button>
          <Space>
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button
              type="primary"
              onClick={handleApply}
              disabled={
                draft.period === "custom" && (!draft.dateRange?.[0] || !draft.dateRange?.[1])
              }
            >
              ใช้ตัวกรอง
            </Button>
          </Space>
        </div>
      }
    >
      <div className="max-h-[62vh] space-y-5 overflow-y-auto py-1 pr-1">
        <section>
          <div className="mb-2 text-sm font-semibold text-slate-800">ช่วงเวลา (วันที่รับเรื่อง)</div>
          <Radio.Group
            optionType="button"
            buttonStyle="solid"
            value={draft.period}
            options={PERIOD_OPTIONS}
            onChange={(event) =>
              patch({
                period: event.target.value,
                dateRange: event.target.value === "custom" ? draft.dateRange : null,
              })
            }
          />
          {draft.period === "custom" ? (
            <div className="mt-3">
              <DatePicker.RangePicker
                className="w-full"
                value={draft.dateRange}
                onChange={(range) => patch({ dateRange: range })}
                format="DD/MM/YYYY"
                allowClear={false}
              />
            </div>
          ) : null}
        </section>

        <section>
          <div className="mb-2 text-sm font-semibold text-slate-800">ประเภทที่ต้องการกรอง</div>
          <div className="mb-2 text-[11px] text-slate-400">
            ติ๊กประเภทที่ต้องการ แล้วเลือกค่าด้านล่าง (เลือกได้หลายรายการ)
          </div>
          <Checkbox.Group
            className="flex flex-wrap gap-x-4 gap-y-2"
            value={draft.enabledTypes}
            onChange={(keys) => {
              const next = new Set(keys);
              setDraft((current) => ({
                ...current,
                enabledTypes: keys,
                ...Object.fromEntries(
                  FILTER_TYPES.map((item) => [
                    item.field,
                    next.has(item.key) ? current[item.field] : [],
                  ]),
                ),
              }));
            }}
            options={FILTER_TYPES.map((item) => ({ label: item.label, value: item.key }))}
          />
        </section>

        {enabledSet.has("department") ? (
          <CheckboxSection
            title="เลือกหน่วยงานที่รับผิดชอบ"
            options={departmentOptions}
            value={draft.departmentIds}
            onChange={(departmentIds) => patch({ departmentIds })}
            emptyText="ไม่มีหน่วยงานในข้อมูลร้องเรียน"
          />
        ) : null}

        {enabledSet.has("problem") ? (
          <SearchSection
            title="เลือกปัญหาที่ร้องเรียน"
            placeholder="พิมพ์ชื่อปัญหา (ไทย / อังกฤษ)"
            options={problemOptions}
            value={draft.problemIds}
            onChange={(problemIds) => patch({ problemIds })}
          />
        ) : null}

        {enabledSet.has("company") ? (
          <SearchSection
            title="เลือกลูกค้า"
            placeholder="พิมพ์ชื่อลูกค้า (ไทย / อังกฤษ)"
            options={companyOptions}
            value={draft.companyIds}
            onChange={(companyIds) => patch({ companyIds })}
          />
        ) : null}

        {enabledSet.has("machine") ? (
          <CheckboxSection
            title="เลือกเครื่องจักร"
            options={machineOptions}
            value={draft.machineIds}
            onChange={(machineIds) => patch({ machineIds })}
            emptyText="ไม่มีเครื่องจักรใน Master"
          />
        ) : null}

        {enabledSet.has("flute") ? (
          <CheckboxSection
            title="เลือกลอนกระดาษ"
            options={fluteOptions}
            value={draft.fluteIds}
            onChange={(fluteIds) => patch({ fluteIds })}
            emptyText="ไม่มีลอนกระดาษใน Master"
          />
        ) : null}

        {enabledSet.has("grade") ? (
          <CheckboxSection
            title="เลือกเกรดลูกค้า"
            options={gradeOptions}
            value={draft.grades}
            onChange={(grades) => patch({ grades })}
            valueKey="name"
            emptyText="ไม่มีเกรดลูกค้าในข้อมูล"
          />
        ) : null}

        {enabledSet.has("shift") ? (
          <CheckboxSection
            title="เลือกกะการผลิต"
            options={shiftOptions}
            value={draft.shifts}
            onChange={(shifts) => patch({ shifts })}
            valueKey="name"
            emptyText="ไม่มีกะใน Master"
          />
        ) : null}

        {enabledSet.has("status") ? (
          <CheckboxSection
            title="เลือกสถานะดำเนินการ"
            options={statusOptions.map((item) => ({ id: item.status, name: item.label }))}
            value={draft.statuses}
            onChange={(statuses) => patch({ statuses })}
            emptyText="ไม่มีสถานะ"
          />
        ) : null}
      </div>
    </Modal>
  );
}

function CheckboxSection({ title, options, value, onChange, valueKey = "id", emptyText }) {
  const allValues = options.map((item) => item[valueKey]);
  const checkedAll = allValues.length > 0 && allValues.every((item) => value.includes(item));
  const indeterminate = value.length > 0 && !checkedAll;

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {options.length ? (
          <Checkbox
            indeterminate={indeterminate}
            checked={checkedAll}
            onChange={(event) => onChange(event.target.checked ? allValues : [])}
          >
            เลือกทั้งหมด
          </Checkbox>
        ) : null}
      </div>
      {options.length ? (
        <Checkbox.Group
          className="grid grid-cols-1 gap-y-1.5 sm:grid-cols-2"
          value={value}
          onChange={onChange}
          options={options.map((item) => ({ label: item.name, value: item[valueKey] }))}
        />
      ) : (
        <div className="text-sm text-slate-400">{emptyText}</div>
      )}
    </section>
  );
}

/** Long master lists (problems / companies) get a searchable multi-select. */
function SearchSection({ title, placeholder, options, value, onChange }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        <span className="text-[11px] text-slate-400">{options.length} รายการ</span>
      </div>
      <Select
        mode="multiple"
        allowClear
        className="w-full"
        placeholder={placeholder}
        maxTagCount="responsive"
        value={value}
        onChange={onChange}
        optionFilterProp="search"
        options={options.map((item) => ({
          value: item.id,
          label: item.name_en ? `${item.name} · ${item.name_en}` : item.name,
          search: `${item.name} ${item.name_en || ""}`.toLowerCase(),
        }))}
      />
    </section>
  );
}
