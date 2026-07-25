import { useEffect, useMemo, useState } from "react";
import { Button, Checkbox, DatePicker, Modal, Radio, Space, Spin } from "antd";
import dayjs from "dayjs";
import { masterApi } from "../../services/api";

const PERIOD_OPTIONS = [
  { value: "day", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "all", label: "ทั้งหมด" },
  { value: "custom", label: "กำหนดเอง" },
];

const FILTER_TYPES = [
  { key: "machine", label: "แยกเครื่อง" },
  { key: "department", label: "หน่วยงาน / แผนก" },
  { key: "shift", label: "แยกตามกะ" },
  { key: "jobType", label: "ลักษณะงาน" },
];

const DEFAULT_JOB_TYPES = [
  { id: 1, name: "แผ่น" },
  { id: 2, name: "กล่อง" },
];

const EMPTY_DRAFT = {
  period: "month",
  dateRange: null,
  enabledTypes: [],
  machineIds: [],
  departmentIds: [],
  shifts: [],
  jobTypes: [],
};

async function loadMasterOptions(key) {
  const result = await masterApi.list(key, {
    activeOnly: "1",
    page: 1,
    pageSize: 100,
  });
  return (result?.data || []).map((item) => ({
    id: item.id,
    name: item.name,
  }));
}

export function DashboardFilterModal({
  open,
  onClose,
  onApply,
  value,
  machineOptions = [],
  departmentOptions = [],
  shiftOptions = [],
  jobTypeOptions = [],
}) {
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [masterMachines, setMasterMachines] = useState([]);
  const [masterDepartments, setMasterDepartments] = useState([]);
  const [masterShifts, setMasterShifts] = useState([]);

  useEffect(() => {
    if (!open) return;
    setDraft({
      period: value?.period || "month",
      dateRange:
        value?.period === "custom" && value?.from && value?.to
          ? [dayjs(value.from), dayjs(value.to)]
          : null,
      enabledTypes: [
        ...(value?.machineIds?.length ? ["machine"] : []),
        ...(value?.departmentIds?.length ? ["department"] : []),
        ...(value?.shifts?.length ? ["shift"] : []),
        ...(value?.jobTypes?.length ? ["jobType"] : []),
      ],
      machineIds: value?.machineIds || [],
      departmentIds: value?.departmentIds || [],
      shifts: value?.shifts || [],
      jobTypes: value?.jobTypes || [],
    });
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const [machines, departments, shifts] = await Promise.all([
          loadMasterOptions("machines"),
          loadMasterOptions("departments"),
          loadMasterOptions("shifts"),
        ]);
        if (!alive) return;
        setMasterMachines(machines);
        setMasterDepartments(departments);
        setMasterShifts(shifts);
      } catch {
        if (!alive) return;
        setMasterMachines([]);
        setMasterDepartments([]);
        setMasterShifts([]);
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const machines = masterMachines.length ? masterMachines : machineOptions;
  const departments = masterDepartments.length ? masterDepartments : departmentOptions;
  const shiftsList = masterShifts.length ? masterShifts : shiftOptions;
  const jobTypesList = jobTypeOptions.length ? jobTypeOptions : DEFAULT_JOB_TYPES;

  const enabledSet = useMemo(() => new Set(draft.enabledTypes), [draft.enabledTypes]);

  function patch(partial) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function handleReset() {
    setDraft({ ...EMPTY_DRAFT });
  }

  function handleApply() {
    const isCustom = draft.period === "custom";
    const from = isCustom && draft.dateRange?.[0] ? draft.dateRange[0].format("YYYY-MM-DD") : undefined;
    const to = isCustom && draft.dateRange?.[1] ? draft.dateRange[1].format("YYYY-MM-DD") : undefined;

    if (isCustom && (!from || !to)) return;

    onApply({
      period: isCustom ? "custom" : draft.period,
      from,
      to,
      machineIds: enabledSet.has("machine") ? draft.machineIds : [],
      departmentIds: enabledSet.has("department") ? draft.departmentIds : [],
      shifts: enabledSet.has("shift") ? draft.shifts : [],
      jobTypes: enabledSet.has("jobType") ? draft.jobTypes : [],
    });
    onClose();
  }

  return (
    <Modal
      title="ตัวกรอง Dashboard"
      open={open}
      onCancel={onClose}
      width={640}
      destroyOnHidden
      centered
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button onClick={handleReset}>ล้างตัวกรอง</Button>
          <Space>
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button
              type="primary"
              onClick={handleApply}
              disabled={draft.period === "custom" && (!draft.dateRange?.[0] || !draft.dateRange?.[1])}
            >
              ใช้ตัวกรอง
            </Button>
          </Space>
        </div>
      }
    >
      <Spin spinning={loadingOptions}>
        <div className="space-y-5 py-1">
          <section>
            <div className="mb-2 text-sm font-semibold text-slate-800">ช่วงเวลา</div>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              value={draft.period}
              options={PERIOD_OPTIONS}
              onChange={(e) =>
                patch({
                  period: e.target.value,
                  dateRange: e.target.value === "custom" ? draft.dateRange : null,
                })
              }
            />
            {draft.period === "custom" ? (
              <div className="mt-3">
                <DatePicker.RangePicker
                  className="w-full"
                  value={draft.dateRange}
                  onChange={(range) => patch({ dateRange: range })}
                  format="YYYY-MM-DD"
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
                  machineIds: next.has("machine") ? current.machineIds : [],
                  departmentIds: next.has("department") ? current.departmentIds : [],
                  shifts: next.has("shift") ? current.shifts : [],
                  jobTypes: next.has("jobType") ? current.jobTypes : [],
                }));
              }}
              options={FILTER_TYPES.map((item) => ({
                label: item.label,
                value: item.key,
              }))}
            />
          </section>

          {enabledSet.has("machine") ? (
            <FilterCheckboxSection
              title="เลือกเครื่อง"
              options={machines}
              value={draft.machineIds}
              onChange={(machineIds) => patch({ machineIds })}
              emptyText="ไม่มีรายการเครื่องใน Master"
            />
          ) : null}

          {enabledSet.has("department") ? (
            <FilterCheckboxSection
              title="เลือกหน่วยงาน / แผนก"
              options={departments}
              value={draft.departmentIds}
              onChange={(departmentIds) => patch({ departmentIds })}
              emptyText="ไม่มีรายการหน่วยงานใน Master"
            />
          ) : null}

          {enabledSet.has("shift") ? (
            <FilterCheckboxSection
              title="เลือกกะ"
              options={shiftsList}
              value={draft.shifts}
              onChange={(nextShifts) => patch({ shifts: nextShifts })}
              valueKey="name"
              emptyText="ไม่มีรายการกะใน Master"
            />
          ) : null}

          {enabledSet.has("jobType") ? (
            <FilterCheckboxSection
              title="เลือกลักษณะงาน"
              options={jobTypesList}
              value={draft.jobTypes}
              onChange={(jobTypes) => patch({ jobTypes })}
              valueKey="name"
              emptyText="ไม่มีลักษณะงาน"
            />
          ) : null}
        </div>
      </Spin>
    </Modal>
  );
}

function FilterCheckboxSection({
  title,
  options,
  value,
  onChange,
  valueKey = "id",
  emptyText,
}) {
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
            onChange={(e) => onChange(e.target.checked ? allValues : [])}
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
          options={options.map((item) => ({
            label: item.name,
            value: item[valueKey],
          }))}
        />
      ) : (
        <div className="text-sm text-slate-400">{emptyText}</div>
      )}
    </section>
  );
}
