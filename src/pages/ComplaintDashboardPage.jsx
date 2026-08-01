import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Modal,
  Radio,
  Row,
  Segmented,
  Spin,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  ApartmentOutlined,
  BankOutlined,
  FileSearchOutlined,
  FilterOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { complaintDashboardApi } from "../services/api";
import { useSession } from "../hooks/useSession";
import { ComplaintFilterModal } from "../components/dashboard/ComplaintFilterModal";
import { ComplaintSummaryTable } from "../components/dashboard/ComplaintSummaryTable";
import {
  DetailList,
  HorizontalRankChart,
  KpiTile,
  PIE_COLORS,
  Panel,
  SectionTitle,
  VerticalRankChart,
} from "../components/dashboard/primitives";
import { colorForKey, colorsForKeys } from "../utils/colors";
import { cacheGet, cacheGetOrSet, cacheKey, cacheSet } from "../utils/dashboardCache";
import { pct, qty } from "../utils/format";

const PERIODS = [
  { value: "day", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "all", label: "ทั้งหมด" },
];

const TREND_GRAINS = [
  { value: "day", label: "รายวัน" },
  { value: "week", label: "รายสัปดาห์" },
  { value: "month", label: "รายเดือน" },
];

const TREND_STACKS = [
  { value: "department", label: "หน่วยงาน" },
  { value: "problem", label: "ปัญหา" },
  { value: "machine", label: "เครื่อง" },
];

const GRADE_COLORS = {
  A: "#15803d",
  B: "#2563eb",
  C: "#d97706",
  D: "#b91c1c",
  NEW: "#7c3aed",
  X: "#64748b",
};

const KPI_MODAL_META = {
  complaints: {
    title: "รายการข้อร้องเรียน",
    subtitle: "ข้อร้องเรียนทั้งหมดในช่วงที่เลือก",
  },
  companies: {
    title: "ลูกค้าที่ร้องเรียน",
    subtitle: "รายชื่อลูกค้าที่มีข้อร้องเรียน เรียงจากจำนวนครั้งมากสุด",
  },
  problems: {
    title: "ปัญหาที่ถูกร้องเรียน",
    subtitle: "ชนิดปัญหาทั้งหมดในช่วงที่เลือก",
  },
  departments: {
    title: "หน่วยงานที่เกิดปัญหา",
    subtitle: "หน่วยงานที่รับผิดชอบข้อร้องเรียน",
  },
};

function complaintRecordColumns() {
  return [
    {
      title: "วันที่รับเรื่อง",
      dataIndex: "date",
      width: 120,
      sorter: (a, b) => String(a.date || "").localeCompare(String(b.date || "")),
      defaultSortOrder: "descend",
    },
    { title: "PDR", dataIndex: "pdr_no", width: 130, ellipsis: true },
    { title: "ลูกค้า", dataIndex: "company_name", ellipsis: true },
    { title: "ปัญหา", dataIndex: "problem_name", width: 160, ellipsis: true },
    { title: "หน่วยงาน", dataIndex: "department_name", width: 110, ellipsis: true },
    { title: "เครื่อง", dataIndex: "machine_name", width: 90 },
    { title: "เกรด", dataIndex: "grade", width: 70, align: "center" },
    {
      title: "ยอดสั่ง",
      dataIndex: "demand_qty",
      align: "right",
      width: 100,
      render: (value) => qty(value, 0),
      sorter: (a, b) => a.demand_qty - b.demand_qty,
    },
    {
      title: "NG",
      dataIndex: "ng_qty",
      align: "right",
      width: 90,
      render: (value) => qty(value, 0),
      sorter: (a, b) => a.ng_qty - b.ng_qty,
    },
    {
      title: "สถานะ",
      dataIndex: "workflow_label",
      width: 140,
      render: (value, row) => (
        <Tag color={row.workflow_status === "completed" ? "green" : "orange"}>{value}</Tag>
      ),
    },
  ];
}

function rankedColumns(type) {
  return [
    { title: "ลำดับ", width: 70, render: (_v, _r, index) => index + 1 },
    {
      title: KPI_MODAL_META[type]?.title || "รายการ",
      dataIndex: "name",
      ellipsis: true,
      render: (value, row) => (
        <div>
          <div className="text-slate-800">{value}</div>
          {row.name_en ? <div className="text-[11px] text-slate-400">{row.name_en}</div> : null}
        </div>
      ),
    },
    {
      title: "จำนวนครั้ง",
      dataIndex: "count",
      align: "right",
      width: 110,
      render: (value) => Number(value || 0).toLocaleString("th-TH"),
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: "descend",
    },
    {
      title: "ยอดสั่งรวม",
      dataIndex: "demand_qty",
      align: "right",
      width: 120,
      render: (value) => qty(value, 0),
      sorter: (a, b) => a.demand_qty - b.demand_qty,
    },
    {
      title: "NG รวม",
      dataIndex: "ng_qty",
      align: "right",
      width: 110,
      render: (value) => qty(value, 0),
      sorter: (a, b) => a.ng_qty - b.ng_qty,
    },
  ];
}

function DetailModal({
  open,
  title,
  subtitle,
  loading,
  error,
  rows,
  columns,
  width,
  onClose,
  pagination,
  onPaginationChange,
}) {
  const tablePagination = pagination
    ? {
        current: pagination.page,
        pageSize: pagination.pageSize,
        total: pagination.total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        showTotal: (total) => `${total.toLocaleString("th-TH")} รายการ`,
        onChange: (page, pageSize) => onPaginationChange?.(page, pageSize),
      }
    : { pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 20, 50] };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={width}
      style={{ maxWidth: "calc(100vw - 24px)" }}
      centered
      destroyOnHidden
      title={
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[12px] font-normal text-slate-400">{subtitle}</div>
          ) : null}
        </div>
      }
    >
      {error ? <Alert type="error" showIcon message={error} className="mb-3" /> : null}
      <Table
        size="small"
        loading={loading}
        rowKey={(row) => row.id ?? row.name}
        dataSource={rows}
        columns={columns}
        pagination={tablePagination}
        scroll={{ x: 900 }}
        locale={{ emptyText: "ไม่มีข้อมูลในช่วงนี้" }}
      />
    </Modal>
  );
}

function ImpactPanel({ kpi, statuses, grades }) {
  const ngQty = Number(kpi?.total_ng_qty || 0);
  const demandQty = Number(kpi?.total_demand_qty || 0);
  const ngPct = Number(kpi?.ng_pct || 0);
  const completed = Number(kpi?.completed_count || 0);
  const open = Number(kpi?.open_count || 0);
  const completedPct = Number(kpi?.completed_pct || 0);
  const leadTime = kpi?.avg_lead_time_days;

  const activeStatuses = (statuses || []).filter((item) => item.count > 0);
  const statusTotal = activeStatuses.reduce((sum, item) => sum + item.count, 0) || 1;
  const gradeTotal = (grades || []).reduce((sum, item) => sum + item.count, 0) || 1;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4">
          <div className="text-xs font-semibold text-red-700">จำนวนของเสียที่ถูกร้องเรียน (NG)</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {qty(ngQty, 0)} <span className="text-sm font-semibold text-slate-500">แผ่น</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-red-100 pt-3">
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <div className="text-[10px] font-medium text-slate-500">ยอดสั่งผลิตรวม</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(demandQty, 0)} <span className="text-[10px] font-medium">แผ่น</span>
              </div>
            </div>
            <div className="rounded-lg bg-red-100/70 px-2.5 py-2">
              <div className="text-[10px] font-medium text-red-700">คิดเป็นสัดส่วน</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-red-700">
                {pct(ngPct, 2)}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
          <div className="text-xs font-semibold text-emerald-700">ความคืบหน้าการปิดเคส</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {pct(completedPct, 1)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3">
            <div className="rounded-lg bg-emerald-100/60 px-2.5 py-2">
              <div className="text-[10px] font-medium text-emerald-800">ปิดเคสแล้ว</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(completed, 0)} <span className="text-[10px] font-medium">เคส</span>
              </div>
            </div>
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <div className="text-[10px] font-medium text-slate-500">ยังดำเนินการอยู่</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(open, 0)} <span className="text-[10px] font-medium">เคส</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
          <div className="text-xs font-semibold text-amber-700">Lead time เฉลี่ยของเอกสาร</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {leadTime == null ? "—" : qty(leadTime, 1)}{" "}
            <span className="text-sm font-semibold text-slate-500">วัน</span>
          </div>
          <div className="mt-3 border-t border-amber-100 pt-3">
            <div className="mb-1.5 text-[10px] font-medium text-amber-800">
              สัดส่วนตามเกรดลูกค้า
            </div>
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              {(grades || []).map((item) => (
                <div
                  key={item.name}
                  style={{
                    width: `${(item.count / gradeTotal) * 100}%`,
                    background: GRADE_COLORS[item.name] || "#94a3b8",
                  }}
                  title={`เกรด ${item.name} · ${item.count} ครั้ง`}
                />
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {(grades || []).map((item) => (
                <span
                  key={item.name}
                  className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-600"
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: GRADE_COLORS[item.name] || "#94a3b8" }}
                  />
                  {item.name} ({item.count})
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          สถานะการดำเนินการรายขั้นตอน
        </div>
        {activeStatuses.length ? (
          <div className="space-y-2">
            {activeStatuses.map((item) => {
              const share = (item.count / statusTotal) * 100;
              const done = item.status === "completed";
              return (
                <div key={item.status} className="flex items-center gap-3">
                  <div className="w-40 shrink-0 text-[12px] font-medium text-slate-700">
                    {item.label}
                  </div>
                  <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-red-600"}`}
                      style={{ width: `${Math.max(share, 1.5)}%` }}
                    />
                  </div>
                  <div className="w-24 shrink-0 text-right text-[12px] font-bold tabular-nums text-slate-800">
                    {qty(item.count, 0)}{" "}
                    <span className="text-[10px] font-medium text-slate-400">
                      ({share.toFixed(1)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
        )}
      </div>
    </div>
  );
}

function TrendHoverCard({ active, payload, grain }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const problems = (row.problems || []).slice(0, 8);
  const periodLabel = grain === "month" ? "เดือน" : grain === "week" ? "สัปดาห์" : "วันที่";

  return (
    <div className="w-[400px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <div>
          <div className="text-[11px] text-slate-400">{periodLabel}</div>
          <div className="text-sm font-bold text-slate-900">{row.full_label || row.label}</div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">ถูกร้องเรียน</div>
          <div className="text-base font-bold tabular-nums text-red-700">
            {Number(row.count || 0).toLocaleString("th-TH")}{" "}
            <span className="text-xs font-semibold text-red-600/80">ครั้ง</span>
          </div>
        </div>
      </div>
      <div className="px-3.5 py-2.5">
        <div className="mb-2 text-[11px] font-semibold text-slate-500">ปัญหาที่ถูกร้องเรียน</div>
        {problems.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {problems.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="flex items-start justify-between gap-2 text-sm"
              >
                <span className="min-w-0 break-words text-slate-700">{item.name}</span>
                <span className="shrink-0 font-bold tabular-nums text-slate-900">
                  {Number(item.count || 0).toLocaleString("th-TH")}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-400">ไม่มีข้อมูลปัญหา</div>
        )}
        {row.ng_qty ? (
          <div className="mt-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            ของเสีย NG รวม {qty(row.ng_qty, 0)} แผ่น
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ComplaintDashboardPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState(undefined);
  const [customTo, setCustomTo] = useState(undefined);
  const [departmentIds, setDepartmentIds] = useState([]);
  const [problemIds, setProblemIds] = useState([]);
  const [companyIds, setCompanyIds] = useState([]);
  const [machineIds, setMachineIds] = useState([]);
  const [fluteIds, setFluteIds] = useState([]);
  const [grades, setGrades] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [trendGrain, setTrendGrain] = useState("month");
  const [trendStack, setTrendStack] = useState("department");
  const [departmentTab, setDepartmentTab] = useState(null);

  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const filterOptionsRef = useRef(null);

  const [kpiModalType, setKpiModalType] = useState(null);
  const [kpiModalLoading, setKpiModalLoading] = useState(false);
  const [kpiModalError, setKpiModalError] = useState("");
  const [kpiModalRows, setKpiModalRows] = useState([]);
  const [kpiModalPaging, setKpiModalPaging] = useState({ page: 1, pageSize: 10, total: 0 });

  const [entityModal, setEntityModal] = useState(null);
  const [entityModalLoading, setEntityModalLoading] = useState(false);
  const [entityModalError, setEntityModalError] = useState("");
  const [entityModalRows, setEntityModalRows] = useState([]);
  const [entityModalPaging, setEntityModalPaging] = useState({ page: 1, pageSize: 10, total: 0 });
  const entityModalRef = useRef(null);

  const activeFilterCount =
    departmentIds.length +
    problemIds.length +
    companyIds.length +
    machineIds.length +
    fluteIds.length +
    grades.length +
    shifts.length +
    statuses.length +
    (period === "custom" ? 1 : 0);

  const queryParams = useMemo(
    () => ({
      period,
      from: period === "custom" ? customFrom : undefined,
      to: period === "custom" ? customTo : undefined,
      department_ids: departmentIds.length ? departmentIds.join(",") : undefined,
      problem_ids: problemIds.length ? problemIds.join(",") : undefined,
      company_ids: companyIds.length ? companyIds.join(",") : undefined,
      machine_ids: machineIds.length ? machineIds.join(",") : undefined,
      flute_ids: fluteIds.length ? fluteIds.join(",") : undefined,
      grades: grades.length ? grades.join(",") : undefined,
      shifts: shifts.length ? shifts.join(",") : undefined,
      statuses: statuses.length ? statuses.join(",") : undefined,
    }),
    [
      period,
      customFrom,
      customTo,
      departmentIds,
      problemIds,
      companyIds,
      machineIds,
      fluteIds,
      grades,
      shifts,
      statuses,
    ],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const options = await cacheGetOrSet("complaint-filter-options", () =>
          complaintDashboardApi.getFilterOptions(),
        );
        if (!alive) return;
        filterOptionsRef.current = options;
        setFilterOptions(options);
        setData((prev) => (prev ? { ...prev, ...options } : prev));
      } catch {
        /* filter modal can still open with empty lists */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const summaryKey = cacheKey("complaint-summary", queryParams);
        const cached = cacheGet(summaryKey);
        const summary =
          cached ||
          cacheSet(summaryKey, await complaintDashboardApi.getSummary(queryParams));
        if (!alive) return;

        const options = filterOptionsRef.current || {};
        setData((prev) => ({
          ...(prev || {}),
          ...options,
          ...summary,
          // keep previous trend until the trend effect fills it
          trend: prev?.trend,
          trendStacks: prev?.trendStacks,
          trendGrain: prev?.trendGrain,
        }));

        const first = summary.departmentsWithTopProblems?.[0]?.id;
        setDepartmentTab((current) => {
          if (
            current &&
            summary.departmentsWithTopProblems?.some((item) => String(item.id) === current)
          ) {
            return current;
          }
          return first ? String(first) : null;
        });
      } catch (err) {
        if (alive) setError(err.message || "โหลด Dashboard Complaint ไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [queryParams]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setTrendLoading(true);
      try {
        const trendParams = { ...queryParams, trend_grain: trendGrain };
        const trendKey = cacheKey("complaint-trend", trendParams);
        const cached = cacheGet(trendKey);
        const trend =
          cached || cacheSet(trendKey, await complaintDashboardApi.getTrend(trendParams));
        if (!alive) return;
        setData((prev) => ({
          ...(prev || {}),
          trendGrain: trend.trendGrain,
          trend: trend.trend,
          trendStacks: trend.trendStacks,
          filters: {
            ...(prev?.filters || {}),
            ...(trend.filters || {}),
          },
        }));
      } catch (err) {
        if (alive) setError(err.message || "โหลดแนวโน้มไม่สำเร็จ");
      } finally {
        if (alive) setTrendLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [queryParams, trendGrain]);

  const thaiDate = useMemo(
    () =>
      new Date().toLocaleDateString("th-TH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    [],
  );

  const filterSummary = useMemo(() => {
    if (!data?.filters) return null;
    const parts = [`ช่วง ${data.filters.from} → ${data.filters.to}`];
    const options = filterOptions || data;
    const describe = (label, ids, opts, key = "id") => {
      if (!ids.length) return;
      const names = (opts || [])
        .filter((item) => ids.includes(item[key]))
        .map((item) => item.name);
      parts.push(names.length ? `${label} ${names.join(", ")}` : `${label} ${ids.length} รายการ`);
    };

    describe("หน่วยงาน", departmentIds, options.departmentOptions);
    describe("ปัญหา", problemIds, options.problemOptions);
    describe("ลูกค้า", companyIds, options.companyOptions);
    describe("เครื่อง", machineIds, options.machineOptions);
    describe("ลอน", fluteIds, options.fluteOptions);
    if (grades.length) parts.push(`เกรด ${grades.join(", ")}`);
    if (shifts.length) parts.push(`กะ ${shifts.join(", ")}`);
    if (statuses.length) parts.push(`สถานะ ${statuses.length} รายการ`);

    return parts.join(" · ");
  }, [
    data,
    filterOptions,
    departmentIds,
    problemIds,
    companyIds,
    machineIds,
    fluteIds,
    grades,
    shifts,
    statuses,
  ]);

  const problemTotal = useMemo(
    () => (data?.topProblems || []).reduce((sum, item) => sum + Number(item.count || 0), 0) || 1,
    [data],
  );

  const activeStack = data?.trendStacks?.[trendStack] || { keys: [], rows: [] };
  const stackColors = useMemo(() => colorsForKeys(activeStack.keys), [activeStack.keys]);
  const showTrendLabels = activeStack.rows.length > 0 && activeStack.rows.length <= 14;
  const trendNoun = trendGrain === "month" ? "เดือน" : trendGrain === "week" ? "สัปดาห์" : "วัน";

  function handleQuickPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setCustomFrom(undefined);
    setCustomTo(undefined);
  }

  function handleApplyFilters(next) {
    setPeriod(next.period);
    setCustomFrom(next.from);
    setCustomTo(next.to);
    setDepartmentIds(next.departmentIds || []);
    setProblemIds(next.problemIds || []);
    setCompanyIds(next.companyIds || []);
    setMachineIds(next.machineIds || []);
    setFluteIds(next.fluteIds || []);
    setGrades(next.grades || []);
    setShifts(next.shifts || []);
    setStatuses(next.statuses || []);
  }

  const loadKpiModal = useCallback(
    async (type, page = 1, pageSize = 10) => {
      setKpiModalLoading(true);
      setKpiModalError("");
      try {
        const params = { ...queryParams, type, page, pageSize };
        const key = cacheKey("complaint-kpi-detail", params);
        const result =
          cacheGet(key) || cacheSet(key, await complaintDashboardApi.getKpiDetail(params));
        setKpiModalRows(result.rows || []);
        setKpiModalPaging({
          page: result.page || page,
          pageSize: result.pageSize || pageSize,
          total: result.total ?? (result.rows || []).length,
        });
      } catch (err) {
        setKpiModalError(err.message || "โหลดรายละเอียดไม่สำเร็จ");
      } finally {
        setKpiModalLoading(false);
      }
    },
    [queryParams],
  );

  async function openKpiModal(type) {
    setKpiModalType(type);
    setKpiModalRows([]);
    setKpiModalPaging({ page: 1, pageSize: 10, total: 0 });
    await loadKpiModal(type, 1, 10);
  }

  const loadEntityModal = useCallback(
    async (meta, page = 1, pageSize = 10) => {
      if (!meta?.dimension || !meta?.entityId) return;
      setEntityModalLoading(true);
      setEntityModalError("");
      try {
        const params = {
          ...queryParams,
          dimension: meta.dimension,
          id: meta.entityId,
          problem_id: meta.problemId,
          page,
          pageSize,
        };
        const key = cacheKey("complaint-entity-detail", params);
        const result =
          cacheGet(key) || cacheSet(key, await complaintDashboardApi.getEntityDetail(params));
        setEntityModalRows(result.rows || []);
        setEntityModalPaging({
          page: result.page || page,
          pageSize: result.pageSize || pageSize,
          total: result.total ?? (result.rows || []).length,
        });
      } catch (err) {
        setEntityModalError(err.message || "โหลดรายละเอียดไม่สำเร็จ");
      } finally {
        setEntityModalLoading(false);
      }
    },
    [queryParams],
  );

  async function openEntityModal(dimension, entity, extra = {}) {
    if (!entity?.id) return;
    const meta = {
      dimension,
      entityId: entity.id,
      problemId: extra.problemId,
      title: `${extra.titlePrefix || "รายละเอียด"}: ${entity.name}`,
      subtitle: "ข้อร้องเรียนที่เกี่ยวข้องในช่วงและตัวกรองปัจจุบัน",
    };
    entityModalRef.current = meta;
    setEntityModal(meta);
    setEntityModalRows([]);
    setEntityModalPaging({ page: 1, pageSize: 10, total: 0 });
    await loadEntityModal(meta, 1, 10);
  }

  const departmentPanels = data?.departmentsWithTopProblems || [];
  const filterOpts = filterOptions || data || {};

  return (
    <div className="space-y-5">
      <Card
        className="overflow-hidden rounded-xl border-0 shadow-sm"
        styles={{
          body: {
            padding: 20,
            background: "linear-gradient(90deg, #0f172a 0%, #7f1d1d 100%)",
          },
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 text-white">
            <div className="text-xs text-red-200">Dashboard Complaint</div>
            <div className="truncate text-lg font-semibold">
              สวัสดี, {user?.display_name || user?.username}
            </div>
            <div className="text-xs text-slate-300">{thaiDate}</div>
          </div>
        </div>
      </Card>

      <div className="sticky top-16 z-10 -mx-1 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="hidden min-w-0 md:block">
            <div className="text-xs font-semibold text-slate-700">ตัวกรอง Dashboard</div>
            {filterSummary ? (
              <div className="truncate text-[11px] text-slate-500">{filterSummary}</div>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 overflow-x-auto md:flex-none">
            <div className="flex w-max items-center gap-2 md:ml-auto">
              <Radio.Group
                size="small"
                optionType="button"
                buttonStyle="solid"
                value={period === "custom" ? undefined : period}
                options={PERIODS}
                onChange={(event) => handleQuickPeriod(event.target.value)}
              />
              <Badge count={activeFilterCount} size="small" offset={[-2, 2]}>
                <Button size="small" icon={<FilterOutlined />} onClick={() => setFilterOpen(true)}>
                  ตัวกรอง
                </Button>
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <ComplaintFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        value={{
          period,
          from: customFrom,
          to: customTo,
          departmentIds,
          problemIds,
          companyIds,
          machineIds,
          fluteIds,
          grades,
          shifts,
          statuses,
        }}
        departmentOptions={filterOpts.departmentOptions || []}
        problemOptions={filterOpts.problemOptions || []}
        companyOptions={filterOpts.companyOptions || []}
        machineOptions={filterOpts.machineOptions || []}
        fluteOptions={filterOpts.fluteOptions || []}
        gradeOptions={filterOpts.gradeOptions || []}
        shiftOptions={filterOpts.shiftOptions || []}
        statusOptions={data?.statuses || []}
      />

      {error ? <Alert type="error" showIcon message={error} className="mb-1" /> : null}

      <Spin spinning={loading} className="block w-full">
        <div className="mt-6 space-y-6">
          <section>
            <SectionTitle>1) สรุปตัวเลขสำคัญ</SectionTitle>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
              <KpiTile
                icon={<FileSearchOutlined />}
                label="จำนวนครั้งที่ถูกร้องเรียน"
                value={`${(data?.kpi?.total_count || 0).toLocaleString("th-TH")} ครั้ง`}
                hint="คลิกดูรายการ · ข้อร้องเรียนในช่วงนี้"
                tone="red"
                onClick={() => openKpiModal("complaints")}
              />
              <KpiTile
                icon={<TagsOutlined />}
                label="ปัญหาที่ถูกร้องเรียน"
                value={`${(data?.kpi?.problem_count || 0).toLocaleString("th-TH")} ประเภท`}
                hint="คลิกดูรายการ · ชนิดปัญหาในช่วงนี้"
                tone="orange"
                onClick={() => openKpiModal("problems")}
              />
              <KpiTile
                icon={<BankOutlined />}
                label="ลูกค้าที่ร้องเรียน"
                value={`${(data?.kpi?.company_count || 0).toLocaleString("th-TH")} ราย`}
                hint="คลิกดูรายชื่อ · ลูกค้าที่แจ้งเรื่องเข้ามา"
                tone="amber"
                onClick={() => openKpiModal("companies")}
              />
              <KpiTile
                icon={<ApartmentOutlined />}
                label="หน่วยงานที่เกิดปัญหา"
                value={`${(data?.kpi?.department_count || 0).toLocaleString("th-TH")} หน่วยงาน`}
                hint="คลิกดูรายการ · หน่วยงานที่รับผิดชอบ"
                tone="rose"
                onClick={() => openKpiModal("departments")}
              />
            </div>
          </section>

          <DetailModal
            open={Boolean(kpiModalType)}
            title={KPI_MODAL_META[kpiModalType]?.title}
            subtitle={
              kpiModalType === "complaints" && kpiModalPaging.total
                ? `${KPI_MODAL_META[kpiModalType]?.subtitle} · ${kpiModalPaging.total.toLocaleString("th-TH")} รายการ`
                : KPI_MODAL_META[kpiModalType]?.subtitle
            }
            loading={kpiModalLoading}
            error={kpiModalError}
            rows={kpiModalRows}
            columns={
              kpiModalType === "complaints"
                ? complaintRecordColumns()
                : rankedColumns(kpiModalType)
            }
            width={kpiModalType === "complaints" ? 1200 : 860}
            pagination={kpiModalType === "complaints" ? kpiModalPaging : undefined}
            onPaginationChange={(page, pageSize) => loadKpiModal(kpiModalType, page, pageSize)}
            onClose={() => {
              setKpiModalType(null);
              setKpiModalError("");
              setKpiModalRows([]);
            }}
          />

          <DetailModal
            open={Boolean(entityModal)}
            title={entityModal?.title}
            subtitle={
              entityModalPaging.total
                ? `${entityModal?.subtitle} · ${entityModalPaging.total.toLocaleString("th-TH")} รายการ`
                : entityModal?.subtitle
            }
            loading={entityModalLoading}
            error={entityModalError}
            rows={entityModalRows}
            columns={complaintRecordColumns()}
            width={1200}
            pagination={entityModalPaging}
            onPaginationChange={(page, pageSize) =>
              loadEntityModal(entityModalRef.current || entityModal, page, pageSize)
            }
            onClose={() => {
              setEntityModal(null);
              entityModalRef.current = null;
              setEntityModalError("");
              setEntityModalRows([]);
            }}
          />

          <section>
            <SectionTitle>2) ผลกระทบและสถานะการดำเนินการ</SectionTitle>
            <Panel
              title="ของเสีย NG · การปิดเคส · เกรดลูกค้า"
              subtitle="เทียบปริมาณ NG กับยอดสั่งผลิต และดูว่าเคสค้างอยู่ที่ขั้นตอนไหน"
            >
              <ImpactPanel kpi={data?.kpi} statuses={data?.statuses} grades={data?.grades} />
            </Panel>
          </section>

          <section>
            <SectionTitle>3) ปัญหาและลูกค้าที่ร้องเรียน</SectionTitle>
            <Row gutter={[16, 16]} align="stretch">
              <Col xs={24} xl={11} className="flex">
                <div className="w-full">
                  <Panel
                    title="Top 5 ปัญหาที่ถูกร้องเรียน"
                    subtitle="สัดส่วนปัญหาที่ลูกค้าแจ้งเข้ามาบ่อยที่สุด · คลิกเพื่อดูรายการ"
                  >
                    {(data?.topProblems || []).length ? (
                      <div className="flex h-full flex-col">
                        <div
                          className="relative mx-auto w-full max-w-[380px] shrink-0"
                          style={{ height: 300 }}
                        >
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie
                                data={data.topProblems}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={78}
                                outerRadius={120}
                                paddingAngle={3}
                                stroke="#fff"
                                strokeWidth={3}
                                label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
                                labelLine={{ stroke: "#94a3b8", strokeWidth: 1 }}
                                onClick={(entry) =>
                                  openEntityModal("problem", entry?.payload || entry, {
                                    titlePrefix: "ปัญหา",
                                  })
                                }
                                cursor="pointer"
                              >
                                {data.topProblems.map((entry, index) => (
                                  <Cell
                                    key={entry.id || entry.name}
                                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                                    style={{
                                      filter: "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.12))",
                                    }}
                                  />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, _name, props) => [
                                  `${Number(value).toLocaleString("th-TH")} ครั้ง`,
                                  props?.payload?.name || "จำนวน",
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-[11px] tracking-wide text-slate-400 uppercase">
                                รวม Top 5
                              </div>
                              <div className="text-2xl font-bold text-slate-900">
                                {problemTotal.toLocaleString("th-TH")}
                              </div>
                              <div className="text-xs text-slate-500">ครั้ง</div>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 min-h-0 flex-1 overflow-auto">
                          <DetailList
                            items={data.topProblems}
                            colors={PIE_COLORS}
                            renderMeta={(item) => item.name_en}
                            onSelect={(item) =>
                              openEntityModal("problem", item, { titlePrefix: "ปัญหา" })
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
                    )}
                  </Panel>
                </div>
              </Col>
              <Col xs={24} xl={13} className="flex">
                <div className="w-full">
                  <Panel
                    title="Top 5 ลูกค้าที่ร้องเรียน"
                    subtitle="ชื่อลูกค้า + จำนวนครั้งที่ร้องเรียน · คลิกเพื่อดูรายการ"
                  >
                    <HorizontalRankChart
                      items={data?.topCompanies || []}
                      height={300}
                      renderMeta={(item) => item.name_en}
                      onSelect={(item) =>
                        openEntityModal("company", item, { titlePrefix: "ลูกค้า" })
                      }
                    />
                  </Panel>
                </div>
              </Col>
            </Row>
          </section>

          <section>
            <SectionTitle>4) หน่วยงานที่เกิดปัญหา</SectionTitle>
            <div className="space-y-4">
              <Panel
                title="Top 5 หน่วยงานที่รับผิดชอบข้อร้องเรียน"
                subtitle="เรียงจากหน่วยงานที่ถูกร้องเรียนบ่อยที่สุด · คลิกเพื่อดูรายการ"
              >
                <VerticalRankChart
                  items={data?.topDepartments || []}
                  height={300}
                  onSelect={(item) =>
                    openEntityModal("department", item, { titlePrefix: "หน่วยงาน" })
                  }
                />
              </Panel>

              <Panel
                title="Top 3 ปัญหาของแต่ละหน่วยงาน"
                subtitle="สลับแท็บเพื่อดูปัญหาที่ถูกร้องเรียนมากที่สุดของหน่วยงานนั้น"
              >
                {departmentPanels.length ? (
                  <Tabs
                    size="small"
                    activeKey={departmentTab || String(departmentPanels[0]?.id)}
                    onChange={setDepartmentTab}
                    items={departmentPanels.map((department) => ({
                      key: String(department.id),
                      label: (
                        <span>
                          {department.name}
                          <span className="ml-1 text-slate-400">
                            ({Number(department.count || 0).toLocaleString("th-TH")} ครั้ง)
                          </span>
                        </span>
                      ),
                      children: (
                        <div className="pt-2">
                          <VerticalRankChart
                            items={department.topProblems || []}
                            height={300}
                            emptyText="ไม่มีปัญหาในหน่วยงานนี้"
                            onSelect={(item) =>
                              openEntityModal("department", department, {
                                titlePrefix: `${department.name} · ${item.name}`,
                                problemId: item.id,
                              })
                            }
                          />
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
                )}
              </Panel>
            </div>
          </section>

          <section>
            <SectionTitle>5) แนวโน้มการร้องเรียน</SectionTitle>
            <Panel
              title={`จำนวนครั้งที่ถูกร้องเรียนราย${trendNoun}`}
              subtitle="แท่งแบ่งสีตามมิติที่เลือก · วางเมาส์เพื่อดูปัญหาในช่วงนั้น"
              action={
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Segmented
                    size="small"
                    value={trendStack}
                    options={TREND_STACKS}
                    onChange={setTrendStack}
                  />
                  <Radio.Group
                    size="small"
                    optionType="button"
                    buttonStyle="solid"
                    value={trendGrain}
                    options={TREND_GRAINS}
                    onChange={(event) => setTrendGrain(event.target.value)}
                  />
                </div>
              }
            >
              <Spin spinning={trendLoading}>
                {activeStack.rows.length ? (
                  <div className="h-[340px]">
                    <ResponsiveContainer>
                      <BarChart
                        data={activeStack.rows}
                        margin={{ top: 18, right: 8, left: 0, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 10 }}
                          interval={activeStack.rows.length > 16 ? "preserveStartEnd" : 0}
                          angle={activeStack.rows.length > 12 ? -30 : 0}
                          textAnchor={activeStack.rows.length > 12 ? "end" : "middle"}
                          height={activeStack.rows.length > 12 ? 50 : 30}
                        />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} width={28} />
                        <Tooltip
                          cursor={{ fill: "rgba(185, 28, 28, 0.08)" }}
                          content={<TrendHoverCard grain={trendGrain} />}
                          wrapperStyle={{ zIndex: 20, outline: "none" }}
                        />
                        <Legend
                          wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
                          iconType="circle"
                          iconSize={8}
                        />
                        {activeStack.keys.map((key, index) => (
                          <Bar
                            key={key}
                            dataKey={key}
                            name={key}
                            stackId="period"
                            fill={stackColors[key] || colorForKey(key, index)}
                            maxBarSize={42}
                            radius={
                              index === activeStack.keys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                            }
                          >
                            {activeStack.keys.length > 1 ? (
                              <LabelList
                                dataKey={key}
                                position="center"
                                formatter={(value) => (Number(value) > 0 ? qty(value) : "")}
                                style={{
                                  fill: "#ffffff",
                                  stroke: "rgba(15, 23, 42, 0.45)",
                                  strokeWidth: 1,
                                  paintOrder: "stroke",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  pointerEvents: "none",
                                }}
                              />
                            ) : null}
                            {showTrendLabels && index === activeStack.keys.length - 1 ? (
                              <LabelList
                                dataKey="count"
                                position="top"
                                style={{ fill: "#0f172a", fontSize: 10, fontWeight: 700 }}
                              />
                            ) : null}
                          </Bar>
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
                )}
              </Spin>
            </Panel>
          </section>

          <section>
            <SectionTitle>6) ตารางสรุปปัญหาที่ลูกค้าร้องเรียน</SectionTitle>
            <Panel
              title="เปรียบเทียบรายเดือน / รายสัปดาห์"
              subtitle="เลือกมิติที่ต้องการเทียบ · แถวขยายได้เพื่อดูปัญหาย่อย · ใช้ตัวกรองเดียวกับ Dashboard"
            >
              <ComplaintSummaryTable
                period={period}
                from={customFrom}
                to={customTo}
                departmentIds={departmentIds}
                problemIds={problemIds}
                companyIds={companyIds}
                machineIds={machineIds}
                fluteIds={fluteIds}
                grades={grades}
                shifts={shifts}
                statuses={statuses}
              />
            </Panel>
          </section>
        </div>
      </Spin>
    </div>
  );
}
