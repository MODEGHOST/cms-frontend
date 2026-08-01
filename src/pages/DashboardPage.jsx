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
  Spin,
  Table,
  Tabs,
} from "antd";
import {
  AlertOutlined,
  BankOutlined,
  BarChartOutlined,
  FilterOutlined,
  FileSearchOutlined,
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
import { dashboardApi } from "../services/api";
import { useSession } from "../hooks/useSession";
import { DashboardFilterModal } from "../components/dashboard/DashboardFilterModal";
import { MachineComparisonPanel } from "../components/dashboard/MachineComparisonPanel";
import {
  BAR_COLORS,
  DetailList,
  HorizontalRankChart,
  KpiTile,
  PIE_COLORS,
  Panel,
  SectionTitle,
  VerticalRankChart,
  YAxisTick,
} from "../components/dashboard/primitives";
import { colorForKey, colorsForKeys } from "../utils/colors";
import { cacheGet, cacheGetOrSet, cacheKey, cacheSet } from "../utils/dashboardCache";
import { money, pct, qty } from "../utils/format";

const PERIODS = [
  { value: "day", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "all", label: "ทั้งหมด" },
];

const KPI_MODAL_META = {
  rejects: {
    title: "รายละเอียดจำนวน Reject",
    subtitle: "รายการ Reject ทั้งหมดในช่วงที่เลือก",
  },
  amount: {
    title: "รายละเอียดมูลค่า Reject",
    subtitle: "สรุปมูลค่าตามบริษัทลูกค้า เรียงจากมูลค่าสูงสุด",
  },
  companies: {
    title: "บริษัทที่ติดปัญหา",
    subtitle: "รายชื่อบริษัทที่มี Reject ในช่วงที่เลือก",
  },
  problems: {
    title: "ประเภทปัญหาที่พบ",
    subtitle: "ชนิดปัญหาทั้งหมดในช่วงที่เลือก",
  },
};

function KpiDetailModal({
  open,
  type,
  loading,
  error,
  rows,
  onClose,
  pagination,
  onPaginationChange,
  subtitleExtra,
}) {
  const meta = KPI_MODAL_META[type] || { title: "รายละเอียด", subtitle: "" };
  const subtitle = [meta.subtitle, subtitleExtra].filter(Boolean).join(" · ");

  const columns =
    type === "rejects"
      ? [
          {
            title: "วันที่",
            dataIndex: "date",
            width: 110,
            sorter: (a, b) => String(a.date || "").localeCompare(String(b.date || "")),
          },
          { title: "บริษัท", dataIndex: "company_name", ellipsis: true },
          { title: "หน่วยงาน", dataIndex: "department_name", width: 120, ellipsis: true },
          { title: "เครื่อง", dataIndex: "machine_name", width: 100 },
          { title: "ปัญหา", dataIndex: "problem_name", ellipsis: true },
          { title: "กะ", dataIndex: "shift", width: 60 },
          {
            title: "แผ่น",
            dataIndex: "claim_sheet_qty",
            align: "right",
            width: 90,
            render: (v) => qty(v, 0),
            sorter: (a, b) => a.claim_sheet_qty - b.claim_sheet_qty,
          },
          {
            title: "น้ำหนัก (KG)",
            dataIndex: "reject_weight",
            align: "right",
            width: 110,
            render: (v) => qty(v, 1),
          },
          {
            title: "มูลค่า (บาท)",
            dataIndex: "reject_amount",
            align: "right",
            width: 120,
            render: (v) => money(v),
            sorter: (a, b) => a.reject_amount - b.reject_amount,
          },
        ]
      : [
          {
            title: "ลำดับ",
            width: 70,
            render: (_v, _r, index) => index + 1,
          },
          {
            title: type === "problems" ? "ปัญหา" : "บริษัท",
            dataIndex: "name",
            ellipsis: true,
          },
          {
            title: "ครั้ง",
            dataIndex: "count",
            align: "right",
            width: 90,
            render: (v) => Number(v || 0).toLocaleString("th-TH"),
            sorter: (a, b) => a.count - b.count,
            defaultSortOrder: type === "companies" || type === "problems" ? "descend" : undefined,
          },
          {
            title: "แผ่น",
            dataIndex: "claim_sheet_qty",
            align: "right",
            width: 100,
            render: (v) => qty(v, 0),
            sorter: (a, b) => a.claim_sheet_qty - b.claim_sheet_qty,
          },
          {
            title: "น้ำหนัก (KG)",
            dataIndex: "reject_weight",
            align: "right",
            width: 110,
            render: (v) => qty(v, 1),
          },
          {
            title: "มูลค่า (บาท)",
            dataIndex: "reject_amount",
            align: "right",
            width: 120,
            render: (v) => money(v),
            sorter: (a, b) => a.reject_amount - b.reject_amount,
            defaultSortOrder: type === "amount" ? "descend" : undefined,
          },
        ];

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
      width={type === "rejects" ? 1100 : 860}
      title={
        <div>
          <div className="text-base font-semibold text-slate-900">{meta.title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[12px] font-normal text-slate-400">{subtitle}</div>
          ) : null}
        </div>
      }
      destroyOnHidden
    >
      {error ? <Alert type="error" showIcon message={error} className="mb-3" /> : null}
      <Table
        size="small"
        loading={loading}
        rowKey={(row) => row.id || row.name}
        dataSource={rows}
        columns={columns}
        pagination={tablePagination}
        scroll={{ x: type === "rejects" ? 980 : 700 }}
        locale={{ emptyText: "ไม่มีข้อมูลในช่วงนี้" }}
      />
    </Modal>
  );
}

function RejectImpactPanel({ kpi }) {
  const claimSheets = Number(kpi?.total_claim_sheet_qty || 0);
  const shipSheets = Number(kpi?.total_actual_ship_qty || 0);
  const rejectWeight = Number(kpi?.total_reject_weight || 0);
  const shipWeight = Number(kpi?.total_ship_weight || 0);
  const rejectAmount = Number(kpi?.total_reject_amount ?? kpi?.total_claim_amount ?? 0);
  const shipAmount = Number(kpi?.total_ship_amount || 0);
  const weightPct = Number(kpi?.weight_reject_pct || 0);
  const valuePct = Number(kpi?.value_reject_pct || 0);
  const sheetPct = shipSheets > 0 ? (claimSheets / shipSheets) * 100 : 0;

  const compareRows = [
    {
      key: "sheet",
      name: "จำนวนแผ่น",
      reject: claimSheets,
      ship: shipSheets,
      pct: sheetPct,
    },
    {
      key: "weight",
      name: "น้ำหนัก",
      reject: rejectWeight,
      ship: shipWeight,
      pct: weightPct,
    },
    {
      key: "value",
      name: "มูลค่า",
      reject: rejectAmount,
      ship: shipAmount,
      pct: valuePct,
    },
  ];

  const barData = compareRows.map((row) => ({
    name: row.name,
    pct: Number(row.pct.toFixed(2)),
    label: pct(row.pct, 2),
  }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4">
          <div className="text-xs font-semibold text-red-700">จำนวนแผ่นที่ Reject</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {qty(claimSheets, 0)} <span className="text-sm font-semibold text-slate-500">แผ่น</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-red-100 pt-3">
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <div className="text-[10px] font-medium text-slate-500">ยอดส่งจริง</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(shipSheets, 0)} <span className="text-[10px] font-medium">แผ่น</span>
              </div>
            </div>
            <div className="rounded-lg bg-red-100/70 px-2.5 py-2">
              <div className="text-[10px] font-medium text-red-700">คิดเป็นสัดส่วน</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-red-700">
                {pct(sheetPct, 2)}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
          <div className="text-xs font-semibold text-amber-700">สัดส่วน Reject ตามน้ำหนัก</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {pct(weightPct, 2)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-amber-100 pt-3">
            <div className="rounded-lg bg-amber-100/60 px-2.5 py-2">
              <div className="text-[10px] font-medium text-amber-800">น้ำหนักเคลม</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(rejectWeight, 1)} <span className="text-[10px] font-medium">KG</span>
              </div>
            </div>
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <div className="text-[10px] font-medium text-slate-500">น้ำหนักส่งจริง</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {qty(shipWeight, 1)} <span className="text-[10px] font-medium">KG</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-orange-100 bg-gradient-to-br from-orange-50 to-white p-4">
          <div className="text-xs font-semibold text-orange-700">สัดส่วน Reject ตามมูลค่า</div>
          <div className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {pct(valuePct, 2)}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-orange-100 pt-3">
            <div className="rounded-lg bg-orange-100/60 px-2.5 py-2">
              <div className="text-[10px] font-medium text-orange-800">มูลค่าเคลม</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {money(rejectAmount)} <span className="text-[10px] font-medium">บาท</span>
              </div>
            </div>
            <div className="rounded-lg bg-white/80 px-2.5 py-2">
              <div className="text-[10px] font-medium text-slate-500">มูลค่าส่งจริง</div>
              <div className="mt-0.5 text-sm font-bold tabular-nums text-slate-800">
                {money(shipAmount)} <span className="text-[10px] font-medium">บาท</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
          สัดส่วนเทียบยอดส่งจริง
        </div>
        {claimSheets > 0 || shipSheets > 0 ? (
          <div className="h-[180px]">
            <ResponsiveContainer>
              <BarChart
                data={barData}
                layout="vertical"
                margin={{ top: 8, right: 56, left: 4, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[0, (max) => Math.max(Number(max) * 1.2 || 1, 1)]}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value) => [`${Number(value).toFixed(2)}%`, "สัดส่วน Reject"]}
                  cursor={{ fill: "rgba(185, 28, 28, 0.06)" }}
                />
                <Bar dataKey="pct" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {barData.map((entry, index) => (
                    <Cell
                      key={entry.name}
                      fill={["#b91c1c", "#d97706", "#ea580c"][index % 3]}
                    />
                  ))}
                  <LabelList
                    dataKey="label"
                    position="right"
                    style={{ fill: "#0f172a", fontSize: 12, fontWeight: 700 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
        )}
        <div className="mt-1 text-[11px] leading-4 text-slate-400">
          น้ำหนัก = แผ่นเล็ก × น้ำหนัก/แผ่น · มูลค่า = แผ่นเล็ก × ราคา/แผ่นเล็ก
        </div>
      </div>
    </div>
  );
}

/** Bars of reject % — vertical (few cats on X) or horizontal (many Master names on Y) */
function RejectPctBarChart({
  items,
  valueKey = "reject_pct",
  emptyText = "ไม่มีข้อมูลในช่วงนี้",
  height = 320,
  layout = "vertical",
  tooltipExtra,
  onBarClick,
}) {
  if (!items?.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  const chartData = items.map((item) => {
    const value = Number(item[valueKey] || 0);
    return {
      ...item,
      _pct: Number(value.toFixed(2)),
      label: `${value.toFixed(1)}%`,
    };
  });

  const isHorizontal = layout === "horizontal";
  const chartHeight = isHorizontal
    ? Math.max(height, chartData.length * 28 + 48)
    : height;
  const angled = !isHorizontal && chartData.length > 6;
  const clickable = typeof onBarClick === "function";

  const tooltipContent = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload;
    if (!row) return null;
    return (
      <div className="min-w-[200px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-lg">
        <div className="text-sm font-bold text-slate-900">{row.name}</div>
        <div className="mt-1.5 space-y-1 text-[12px] text-slate-600">
          <div className="flex justify-between gap-3">
            <span>% Reject</span>
            <span className="font-semibold tabular-nums">{pct(row._pct, 2)}</span>
          </div>
          {tooltipExtra ? tooltipExtra(row) : null}
          {clickable ? (
            <div className="pt-1 text-[11px] text-slate-400">คลิกเพื่อดูรายละเอียด</div>
          ) : null}
        </div>
      </div>
    );
  };

  const handleBarClick = (data) => {
    if (!clickable || !data) return;
    const row = data.payload || data;
    if (!row?.id && !row?.name) return;
    onBarClick(row);
  };

  if (isHorizontal) {
    return (
      <div style={{ width: "100%", height: chartHeight }} className="min-h-[280px]">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 64, left: 8, bottom: 8 }}
            barCategoryGap="18%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => `${v}%`}
              domain={[0, "auto"]}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={160}
              interval={0}
              tick={<YAxisTick />}
            />
            <Tooltip cursor={{ fill: "rgba(185, 28, 28, 0.06)" }} content={tooltipContent} />
            <Bar
              dataKey="_pct"
              radius={[0, 8, 8, 0]}
              maxBarSize={22}
              cursor={clickable ? "pointer" : "default"}
              onClick={handleBarClick}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.id || entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
              ))}
              <LabelList
                dataKey="label"
                position="right"
                style={{ fill: "#0f172a", fontSize: 11, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: chartHeight }} className="min-h-[280px]">
      <ResponsiveContainer>
        <BarChart
          data={chartData}
          margin={{ top: 28, right: 12, left: 4, bottom: angled ? 56 : 12 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="name"
            interval={0}
            tick={{ fontSize: 11 }}
            angle={angled ? -28 : 0}
            textAnchor={angled ? "end" : "middle"}
            height={angled ? 70 : 30}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            width={42}
            tickFormatter={(v) => `${v}%`}
            domain={[0, "auto"]}
            allowDecimals
          />
          <Tooltip cursor={{ fill: "rgba(185, 28, 28, 0.06)" }} content={tooltipContent} />
          <Bar
            dataKey="_pct"
            radius={[8, 8, 0, 0]}
            maxBarSize={56}
            cursor={clickable ? "pointer" : "default"}
            onClick={handleBarClick}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.id || entry.name} fill={BAR_COLORS[index % BAR_COLORS.length]} />
            ))}
            <LabelList
              dataKey="label"
              position="top"
              style={{ fill: "#0f172a", fontSize: 11, fontWeight: 700 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RejectDetailModal({
  open,
  title,
  subtitle,
  loading,
  error,
  rows,
  onClose,
  pagination,
  onPaginationChange,
}) {
  const columns = [
    {
      title: "ชื่อเต็มลูกค้า",
      dataIndex: "company_name",
      width: 180,
      ellipsis: true,
    },
    {
      title: "PDR",
      dataIndex: "pdr_no",
      width: 130,
      ellipsis: true,
    },
    {
      title: "Size",
      dataIndex: "size",
      width: 340,
      ellipsis: true,
    },
    {
      title: "หน่วยงานที่รับผิดชอบ",
      dataIndex: "department_name",
      width: 130,
      ellipsis: true,
    },
    {
      title: "เครื่อง",
      dataIndex: "machine_name",
      width: 90,
    },
  ];

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
      width={1100}
      centered
      title={
        <div>
          <div className="text-base font-semibold text-slate-900">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-[12px] font-normal text-slate-400">{subtitle}</div>
          ) : null}
        </div>
      }
      destroyOnHidden
    >
      {error ? <Alert type="error" showIcon message={error} className="mb-3" /> : null}
      <Table
        size="small"
        loading={loading}
        rowKey={(row) => row.id}
        dataSource={rows}
        columns={columns}
        pagination={tablePagination}
        scroll={{ x: 900 }}
        locale={{ emptyText: "ไม่มีรายการในช่วงนี้" }}
      />
    </Modal>
  );
}

function comparisonPeriodLabel(period, grain) {
  const date = new Date(`${period.from}T00:00:00`);
  if (grain === "month") {
    return date.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  }
  if (grain === "week") {
    const end = new Date(`${period.to}T00:00:00`);
    const fromText = date.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    const toText = end.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    return `${fromText}–${toText}`;
  }
  return date.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  });
}

function TopComparisonModal({
  open,
  type,
  previousPeriods,
  data,
  loading,
  error,
  onPeriodsChange,
  onClose,
}) {
  const periods = data?.periods || [];
  const items = data?.items || [];
  const typeLabel = type === "companies" ? "บริษัทลูกค้า" : "ปัญหาที่พบ";
  const grainLabel = data?.grain === "month" ? "เดือน" : data?.grain === "week" ? "สัปดาห์" : "วัน";
  const tableData = items.map((item, index) => {
    const row = {
      key: item.id,
      rank: index + 1,
      name: item.name,
      total_count: Number(item.total_count || 0),
      total_reject_amount: Number(item.total_reject_amount || 0),
    };
    for (const value of item.values || []) row[value.period_key] = value;
    return row;
  });
  const comparisonColumns = [
    {
      title: "Top 5",
      dataIndex: "name",
      key: "name",
      fixed: "left",
      width: 220,
      render: (value, row) => (
        <div className="flex items-start gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
            {row.rank}
          </span>
          <span className="font-medium text-slate-800">{value}</span>
        </div>
      ),
    },
    ...periods.map((item) => ({
      title: (
        <div className={item.current ? "font-bold text-red-700" : ""}>
          <div>{comparisonPeriodLabel(item, data.grain)}</div>
          {item.current ? <div className="text-[10px]">(ปัจจุบัน)</div> : null}
        </div>
      ),
      dataIndex: item.key,
      key: item.key,
      align: "center",
      width: 140,
      render: (value) => (
        <div>
          <div className={`font-bold tabular-nums ${item.current ? "text-red-700" : "text-slate-800"}`}>
            {qty(value?.count)} ครั้ง
          </div>
          {type === "companies" ? (
            <div className="mt-1 text-[11px] font-medium tabular-nums text-slate-600">
              {money(value?.reject_amount)} บาท
            </div>
          ) : null}
        </div>
      ),
    })),
    {
      title: "รวม",
      key: "total",
      align: "center",
      width: 140,
      render: (_, row) => (
        <div>
          <div className="font-bold tabular-nums text-slate-900">
            {qty(row.total_count)} ครั้ง
          </div>
          {type === "companies" ? (
            <div className="mt-1 text-[11px] font-medium tabular-nums text-slate-700">
              {money(row.total_reject_amount)} บาท
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={1400}
      style={{ maxWidth: "calc(100vw - 24px)" }}
      centered
      destroyOnHidden
      title={
        <div>
          <div className="text-base font-semibold text-slate-900">เปรียบเทียบ Top 5 {typeLabel}</div>
          <div className="mt-0.5 text-[12px] font-normal text-slate-400">
            เทียบช่วงปัจจุบันกับข้อมูลย้อนหลัง โดยใช้ตัวกรองเดียวกับ Dashboard
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          เปรียบเทียบย้อนหลัง <span className="font-semibold">{previousPeriods} {grainLabel}</span>
        </div>
        <Radio.Group
          size="small"
          optionType="button"
          buttonStyle="solid"
          value={previousPeriods}
          disabled={loading}
          options={[
            { value: 3, label: `ย้อนหลัง 3 ${grainLabel}` },
            { value: 5, label: `ย้อนหลัง 5 ${grainLabel}` },
          ]}
          onChange={(event) => onPeriodsChange(event.target.value)}
        />
      </div>

      {error ? <Alert type="error" showIcon message={error} className="mb-3" /> : null}
      <Spin spinning={loading}>
        {items.length ? (
          <Table
            size="small"
            bordered
            pagination={false}
            dataSource={tableData}
            columns={comparisonColumns}
            scroll={{ x: 220 + (periods.length + 1) * 140 }}
          />
        ) : !loading && !error ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงที่เลือก" />
        ) : (
          <div className="h-[300px]" />
        )}
      </Spin>
    </Modal>
  );
}

function TrendHoverCard({ active, payload, label, grain = "day" }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const problems = row.problems || [];
  const periodLabel =
    grain === "month" ? "เดือน" : grain === "week" ? "สัปดาห์" : "วันที่";

  return (
    <div className="w-[420px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
        <div>
          <div className="text-[11px] text-slate-400">{periodLabel}</div>
          <div className="text-sm font-bold text-slate-900">
            {row.label || label || row.date}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-slate-400">Reject</div>
          <div className="text-base font-bold tabular-nums text-red-700">
            {Number(row.count || 0).toLocaleString("th-TH")}{" "}
            <span className="text-xs font-semibold text-red-600/80">ครั้ง</span>
          </div>
        </div>
      </div>

      <div className="px-3.5 py-2.5">
        <div className="mb-2 text-[11px] font-semibold text-slate-500">ปัญหาที่ Reject</div>
        {problems.length ? (
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            {problems.map((item, index) => (
              <div key={`${item.name}-${index}`} className="flex items-start justify-between gap-2 text-sm">
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
      </div>
    </div>
  );
}

export function DashboardPage() {
  const { user } = useSession();
  const [period, setPeriod] = useState("month");
  const [customFrom, setCustomFrom] = useState(undefined);
  const [customTo, setCustomTo] = useState(undefined);
  const [machineIds, setMachineIds] = useState([]);
  const [departmentIds, setDepartmentIds] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [jobTypes, setJobTypes] = useState([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const filterOptionsRef = useRef(null);
  const [machineTab, setMachineTab] = useState(null);
  const [kpiModalType, setKpiModalType] = useState(null);
  const [kpiModalLoading, setKpiModalLoading] = useState(false);
  const [kpiModalError, setKpiModalError] = useState("");
  const [kpiModalRows, setKpiModalRows] = useState([]);
  const [kpiModalPaging, setKpiModalPaging] = useState({ page: 1, pageSize: 10, total: 0 });
  const [detailModal, setDetailModal] = useState(null);
  const [detailModalLoading, setDetailModalLoading] = useState(false);
  const [detailModalError, setDetailModalError] = useState("");
  const [detailModalRows, setDetailModalRows] = useState([]);
  const [detailModalPaging, setDetailModalPaging] = useState({ page: 1, pageSize: 10, total: 0 });
  const detailModalRef = useRef(null);
  const [comparisonModalType, setComparisonModalType] = useState(null);
  const [comparisonPreviousPeriods, setComparisonPreviousPeriods] = useState(3);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState("");
  const [comparisonData, setComparisonData] = useState(null);

  const activeFilterCount =
    machineIds.length +
    departmentIds.length +
    shifts.length +
    jobTypes.length +
    (period === "custom" ? 1 : 0);

  const queryParams = useMemo(
    () => ({
      period,
      from: period === "custom" ? customFrom : undefined,
      to: period === "custom" ? customTo : undefined,
      machine_ids: machineIds.length ? machineIds.join(",") : undefined,
      department_ids: departmentIds.length ? departmentIds.join(",") : undefined,
      shifts: shifts.length ? shifts.join(",") : undefined,
      job_types: jobTypes.length ? jobTypes.join(",") : undefined,
    }),
    [period, customFrom, customTo, machineIds, departmentIds, shifts, jobTypes],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const options = await cacheGetOrSet("reject-filter-options", () =>
          dashboardApi.getFilterOptions(),
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
        const summaryKey = cacheKey("reject-summary", queryParams);
        const cached = cacheGet(summaryKey);
        const summary =
          cached || cacheSet(summaryKey, await dashboardApi.getReject(queryParams));
        if (!alive) return;

        const options = filterOptionsRef.current || {};
        setData((prev) => ({
          ...(prev || {}),
          ...options,
          ...summary,
          trend: prev?.trend,
          trendStackKeys: prev?.trendStackKeys,
          trendGrain: prev?.trendGrain,
        }));

        const first = summary.machinesWithTopProblems?.[0]?.id;
        setMachineTab((current) => {
          if (machineIds.length === 1) return String(machineIds[0]);
          if (current && summary.machinesWithTopProblems?.some((m) => String(m.id) === current)) {
            return current;
          }
          return first ? String(first) : null;
        });
      } catch (err) {
        if (alive) setError(err.message || "โหลด Dashboard ไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [queryParams, machineIds]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setTrendLoading(true);
      try {
        const trendKey = cacheKey("reject-trend", queryParams);
        const cached = cacheGet(trendKey);
        const trend =
          cached || cacheSet(trendKey, await dashboardApi.getTrend(queryParams));
        if (!alive) return;
        setData((prev) => ({
          ...(prev || {}),
          trend: trend.trend,
          trendStackKeys: trend.trendStackKeys,
          trendGrain: trend.trendGrain,
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
  }, [queryParams]);

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

  const filterOpts = filterOptions || data || {};

  const filterSummary = useMemo(() => {
    if (!data?.filters) return null;
    const parts = [`ช่วง ${data.filters.from} → ${data.filters.to}`];

    if (machineIds.length) {
      const names = (filterOpts.machineOptions || [])
        .filter((item) => machineIds.includes(item.id))
        .map((item) => item.name);
      parts.push(names.length ? `เครื่อง ${names.join(", ")}` : `เครื่อง ${machineIds.length} รายการ`);
    } else {
      parts.push("ทุกเครื่อง");
    }

    if (departmentIds.length) {
      const names = (filterOpts.departmentOptions || [])
        .filter((item) => departmentIds.includes(item.id))
        .map((item) => item.name);
      parts.push(
        names.length ? `หน่วยงาน ${names.join(", ")}` : `หน่วยงาน ${departmentIds.length} รายการ`,
      );
    }

    if (shifts.length) {
      parts.push(`กะ ${shifts.join(", ")}`);
    }

    if (jobTypes.length) {
      parts.push(`ลักษณะงาน ${jobTypes.join(", ")}`);
    }

    return parts.join(" · ");
  }, [data, filterOpts, machineIds, departmentIds, shifts, jobTypes]);

  const problemTotal = useMemo(
    () => (data?.topProblems || []).reduce((sum, item) => sum + Number(item.count || 0), 0) || 1,
    [data],
  );

  const showTrendLabels = (data?.trend || []).length > 0 && (data?.trend || []).length <= 14;
  const trendStackKeys = useMemo(
    () => (data?.trendStackKeys?.length ? data.trendStackKeys : ["count"]),
    [data?.trendStackKeys],
  );
  const trendStackColors = useMemo(() => colorsForKeys(trendStackKeys), [trendStackKeys]);
  const trendGrain = data?.trendGrain || data?.filters?.trend_grain || "day";
  const trendCopy =
    trendGrain === "month"
      ? {
          section: "4) แนวโน้มรายเดือน",
          title: "จำนวน Reject ตามเดือน (แยกเครื่อง)",
          subtitle: "แท่งแบ่งสีตามเครื่อง · รวมเป็นรายเดือนเมื่อเลือกช่วงยาว · วางเมาส์เพื่อดูรายละเอียด",
        }
      : trendGrain === "week"
        ? {
            section: "4) แนวโน้มรายสัปดาห์",
            title: "จำนวน Reject ตามสัปดาห์ (แยกเครื่อง)",
            subtitle: "แท่งแบ่งสีตามเครื่อง · รวมเป็นรายสัปดาห์ · วางเมาส์เพื่อดูรายละเอียด",
          }
        : {
            section: "4) แนวโน้มรายวัน",
            title: "จำนวน Reject ตามวัน (แยกเครื่อง)",
            subtitle: "แท่งแบ่งสีตามเครื่อง · วางเมาส์เพื่อดูจำนวน Reject และปัญหา",
          };

  const machinePanels = useMemo(() => {
    const list = data?.machinesWithTopProblems || [];
    if (machineIds.length) return list.filter((m) => machineIds.includes(m.id));
    return list;
  }, [data, machineIds]);

  function handleQuickPeriod(nextPeriod) {
    setPeriod(nextPeriod);
    setCustomFrom(undefined);
    setCustomTo(undefined);
  }

  function handleApplyFilters(next) {
    setPeriod(next.period);
    setCustomFrom(next.from);
    setCustomTo(next.to);
    setMachineIds(next.machineIds || []);
    setDepartmentIds(next.departmentIds || []);
    setShifts(next.shifts || []);
    setJobTypes(next.jobTypes || []);
  }

  const loadKpiModal = useCallback(
    async (type, page = 1, pageSize = 10) => {
      setKpiModalLoading(true);
      setKpiModalError("");
      try {
        const params = { ...queryParams, type, page, pageSize };
        const key = cacheKey("reject-kpi-detail", params);
        const result =
          cacheGet(key) || cacheSet(key, await dashboardApi.getKpiDetail(params));
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

  function closeKpiModal() {
    setKpiModalType(null);
    setKpiModalError("");
    setKpiModalRows([]);
  }

  const loadDetailModal = useCallback(
    async (meta, page = 1, pageSize = 10) => {
      if (!meta?.type || !meta?.id) return;
      setDetailModalLoading(true);
      setDetailModalError("");
      try {
        const params = {
          ...queryParams,
          page,
          pageSize,
          ...(meta.type === "problem"
            ? { problem_id: meta.id }
            : { department_id: meta.id }),
        };
        const key = cacheKey(`reject-${meta.type}-detail`, params);
        const fetcher =
          meta.type === "problem"
            ? dashboardApi.getProblemDetail
            : dashboardApi.getDepartmentDetail;
        const result = cacheGet(key) || cacheSet(key, await fetcher(params));
        setDetailModalRows(result.rows || []);
        setDetailModalPaging({
          page: result.page || page,
          pageSize: result.pageSize || pageSize,
          total: result.total ?? (result.rows || []).length,
        });
      } catch (err) {
        setDetailModalError(err.message || "โหลดรายละเอียดไม่สำเร็จ");
      } finally {
        setDetailModalLoading(false);
      }
    },
    [queryParams],
  );

  async function openProblemModal(problem) {
    if (!problem?.id) return;
    const meta = {
      type: "problem",
      id: problem.id,
      name: problem.name,
      title: `รายละเอียดปัญหา: ${problem.name}`,
      subtitle: "รายการ Reject ของปัญหานี้ในช่วงที่เลือก",
    };
    detailModalRef.current = meta;
    setDetailModal(meta);
    setDetailModalRows([]);
    setDetailModalPaging({ page: 1, pageSize: 10, total: 0 });
    await loadDetailModal(meta, 1, 10);
  }

  async function openDepartmentModal(department) {
    if (!department?.id) return;
    const meta = {
      type: "department",
      id: department.id,
      name: department.name,
      title: `รายละเอียดหน่วยงาน: ${department.name}`,
      subtitle: "รายการ Reject ของหน่วยงานนี้ในช่วงที่เลือก",
    };
    detailModalRef.current = meta;
    setDetailModal(meta);
    setDetailModalRows([]);
    setDetailModalPaging({ page: 1, pageSize: 10, total: 0 });
    await loadDetailModal(meta, 1, 10);
  }

  function closeDetailModal() {
    setDetailModal(null);
    detailModalRef.current = null;
    setDetailModalError("");
    setDetailModalRows([]);
  }

  async function loadTopComparison(type, previousPeriods) {
    setComparisonLoading(true);
    setComparisonError("");
    setComparisonData(null);
    try {
      const result = await dashboardApi.getTopComparison({
        type,
        previous_periods: previousPeriods,
        grain:
          period === "custom"
            ? trendGrain
            : period === "all"
              ? "month"
              : period,
        ...queryParams,
      });
      setComparisonData(result);
    } catch (err) {
      setComparisonError(err.message || "โหลดข้อมูลเปรียบเทียบไม่สำเร็จ");
    } finally {
      setComparisonLoading(false);
    }
  }

  function openTopComparison(type) {
    const defaultPreviousPeriods = 3;
    setComparisonModalType(type);
    setComparisonPreviousPeriods(defaultPreviousPeriods);
    loadTopComparison(type, defaultPreviousPeriods);
  }

  function changeComparisonPeriods(nextPreviousPeriods) {
    setComparisonPreviousPeriods(nextPreviousPeriods);
    loadTopComparison(comparisonModalType, nextPreviousPeriods);
  }

  function closeTopComparison() {
    setComparisonModalType(null);
    setComparisonError("");
    setComparisonData(null);
  }

  return (
    <div className="space-y-5">
      {/* Header + filters in one band */}
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
            <div className="text-xs text-red-200">Dashboard Reject</div>
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
              onChange={(e) => handleQuickPeriod(e.target.value)}
            />
            <Badge count={activeFilterCount} size="small" offset={[-2, 2]}>
              <Button
                size="small"
                icon={<FilterOutlined />}
                onClick={() => setFilterOpen(true)}
              >
                ตัวกรอง
              </Button>
            </Badge>
            </div>
          </div>
        </div>
      </div>

      <DashboardFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        value={{
          period,
          from: customFrom,
          to: customTo,
          machineIds,
          departmentIds,
          shifts,
          jobTypes,
        }}
        machineOptions={filterOpts.machineOptions || []}
        departmentOptions={filterOpts.departmentOptions || []}
        shiftOptions={filterOpts.shiftOptions || []}
        jobTypeOptions={filterOpts.jobTypeOptions || []}
      />

      {error ? <Alert type="error" showIcon message={error} className="mb-1" /> : null}

      <Spin spinning={loading} className="block w-full">
        <div className="mt-6 space-y-6">
        {/* 1) KPI — overview first */}
        <section>
        <SectionTitle>1) สรุปตัวเลขสำคัญ</SectionTitle>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4 xl:gap-4">
          <KpiTile
            icon={<FileSearchOutlined />}
            label="จำนวน Reject"
            value={`${(data?.kpi?.total_count || 0).toLocaleString("th-TH")} ครั้ง`}
            hint="คลิกดูรายการ · รายการ Reject ในช่วงนี้"
            tone="red"
            onClick={() => openKpiModal("rejects")}
          />
          <KpiTile
            icon={<AlertOutlined />}
            label="มูลค่า Reject"
            value={`${money(data?.kpi?.total_reject_amount ?? data?.kpi?.total_claim_amount)} บาท`}
            hint="คลิกดูรายละเอียด · แผ่นเล็ก × ราคา/แผ่นเล็ก"
            tone="orange"
            onClick={() => openKpiModal("amount")}
          />
          <KpiTile
            icon={<BankOutlined />}
            label="บริษัทที่ติดปัญหา"
            value={`${(data?.kpi?.company_count || 0).toLocaleString("th-TH")} บริษัท`}
            hint="คลิกดูรายชื่อ · ลูกค้าที่มี Reject"
            tone="amber"
            onClick={() => openKpiModal("companies")}
          />
          <KpiTile
            icon={<TagsOutlined />}
            label="ประเภทปัญหาที่พบ"
            value={`${(data?.kpi?.problem_count || 0).toLocaleString("th-TH")} ประเภท`}
            hint="คลิกดูรายการ · ชนิดปัญหาในช่วงนี้"
            tone="rose"
            onClick={() => openKpiModal("problems")}
          />
        </div>
        </section>

        <KpiDetailModal
          open={Boolean(kpiModalType)}
          type={kpiModalType}
          loading={kpiModalLoading}
          error={kpiModalError}
          rows={kpiModalRows}
          pagination={kpiModalType === "rejects" ? kpiModalPaging : undefined}
          onPaginationChange={(page, pageSize) => loadKpiModal(kpiModalType, page, pageSize)}
          subtitleExtra={
            kpiModalType === "rejects" && kpiModalPaging.total
              ? `${kpiModalPaging.total.toLocaleString("th-TH")} รายการ`
              : undefined
          }
          onClose={closeKpiModal}
        />

        <RejectDetailModal
          open={Boolean(detailModal)}
          title={detailModal?.title}
          subtitle={
            detailModalPaging.total
              ? `${detailModal?.subtitle} · ${detailModalPaging.total.toLocaleString("th-TH")} รายการ`
              : detailModal?.subtitle
          }
          loading={detailModalLoading}
          error={detailModalError}
          rows={detailModalRows}
          pagination={detailModalPaging}
          onPaginationChange={(page, pageSize) =>
            loadDetailModal(detailModalRef.current || detailModal, page, pageSize)
          }
          onClose={closeDetailModal}
        />

        <TopComparisonModal
          open={Boolean(comparisonModalType)}
          type={comparisonModalType}
          previousPeriods={comparisonPreviousPeriods}
          data={comparisonData}
          loading={comparisonLoading}
          error={comparisonError}
          onPeriodsChange={changeComparisonPeriods}
          onClose={closeTopComparison}
        />

        {/* 2) Reject impact + department damage ranking */}
        <section>
          <SectionTitle>2) ผลกระทบจำนวนแผ่นที่ Reject</SectionTitle>
          <Panel
            title="จำนวนแผ่น · สัดส่วนน้ำหนัก · สัดส่วนมูลค่า"
            subtitle="เคลมแผ่นเล็กเทียบยอดส่งจริง"
          >
            <RejectImpactPanel kpi={data?.kpi} />
          </Panel>
        </section>

        {/* 3) % Reject by department + problems bar charts — full width each */}
        <section>
          <SectionTitle>3) % Reject ตามหน่วยงานและปัญหา</SectionTitle>
          <div className="space-y-4">
            <Panel
              title="% Reject ตามหน่วยงาน"
              subtitle="แกน X = หน่วยงานทั้งหมดจาก Master · เรียง % มาก → น้อย · คลิกแท่งเพื่อดูรายละเอียดลูกค้า"
            >
              <RejectPctBarChart
                items={[...(data?.topDepartments || [])].sort(
                  (a, b) => Number(b.reject_pct || 0) - Number(a.reject_pct || 0),
                )}
                valueKey="reject_pct"
                height={340}
                onBarClick={(row) => openDepartmentModal(row)}
                tooltipExtra={(row) => (
                  <>
                    <div className="flex justify-between gap-3">
                      <span>แผ่น Reject</span>
                      <span className="font-semibold tabular-nums">
                        {qty(row.claim_sheet_qty, 0)} แผ่น
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>ยอดส่งจริง</span>
                      <span className="font-semibold tabular-nums">
                        {qty(row.actual_ship_qty, 0)} แผ่น
                      </span>
                    </div>
                  </>
                )}
              />
            </Panel>

            <Panel
              title="% Reject ตามปัญหา (Top 10)"
              subtitle="แกน X = ปัญหา · เรียง % มาก → น้อย · คลิกแท่งเพื่อดูรายละเอียดลูกค้า"
            >
              <RejectPctBarChart
                items={[...(data?.allProblems || [])]
                  .sort((a, b) => Number(b.reject_pct || 0) - Number(a.reject_pct || 0))
                  .slice(0, 10)}
                valueKey="reject_pct"
                layout="vertical"
                height={360}
                emptyText="ไม่มีปัญหาใน Master"
                onBarClick={(row) => openProblemModal(row)}
                tooltipExtra={(row) => (
                  <>
                    <div className="flex justify-between gap-3">
                      <span>ครั้ง</span>
                      <span className="font-semibold tabular-nums">
                        {Number(row.count || 0).toLocaleString("th-TH")} ครั้ง
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>แผ่น Reject</span>
                      <span className="font-semibold tabular-nums">
                        {qty(row.claim_sheet_qty, 0)} แผ่น
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>มูลค่า</span>
                      <span className="font-semibold tabular-nums">
                        {money(row.reject_amount)} บาท
                      </span>
                    </div>
                  </>
                )}
              />
            </Panel>
          </div>
        </section>

        {/* 4) Trend */}
        <section>
          <SectionTitle>{trendCopy.section}</SectionTitle>
          <Panel title={trendCopy.title} subtitle={trendCopy.subtitle}>
            <Spin spinning={trendLoading}>
              {(data?.trend || []).length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer>
                    <BarChart
                      data={data.trend}
                      margin={{ top: 18, right: 8, left: 0, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10 }}
                        interval={data.trend.length > 16 ? "preserveStartEnd" : 0}
                        angle={data.trend.length > 12 ? -30 : 0}
                        textAnchor={data.trend.length > 12 ? "end" : "middle"}
                        height={data.trend.length > 12 ? 50 : 30}
                        minTickGap={trendGrain === "day" ? 8 : 4}
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
                      {trendStackKeys.map((key, index) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key === "count" ? "Reject" : key}
                          stackId="period"
                          fill={trendStackColors[key] || colorForKey(key, index)}
                          maxBarSize={42}
                          radius={
                            index === trendStackKeys.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]
                          }
                        >
                          {trendStackKeys.length > 1 ? (
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
                          {showTrendLabels && index === trendStackKeys.length - 1 ? (
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

        {/* 4) Problems + Companies */}
        <section>
          <SectionTitle>5) ปัญหาและลูกค้า</SectionTitle>
          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} xl={11} className="flex">
              <div className="w-full">
              <Panel
                title="Top 5 ปัญหาที่พบ"
                subtitle="สัดส่วนปัญหาที่เจอบ่อย"
                action={
                  <Button
                    size="small"
                    icon={<BarChartOutlined />}
                    onClick={() => openTopComparison("problems")}
                  >
                    เปรียบเทียบ
                  </Button>
                }
              >
                {(data?.topProblems || []).length ? (
                  <div className="flex h-full flex-col">
                    <div className="relative mx-auto w-full max-w-[380px] shrink-0" style={{ height: 300 }}>
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
                            labelLine={{
                              stroke: "#94a3b8",
                              strokeWidth: 1,
                            }}
                          >
                            {data.topProblems.map((entry, index) => (
                              <Cell
                                key={entry.id || entry.name}
                                fill={PIE_COLORS[index % PIE_COLORS.length]}
                                style={{ filter: "drop-shadow(0 2px 4px rgba(15, 23, 42, 0.12))" }}
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
                      <DetailList items={data.topProblems} colors={PIE_COLORS} />
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
                  title="Top 5 บริษัทลูกค้า"
                  subtitle="ชื่อเต็ม + จำนวนครั้ง + มูลค่า Reject (แผ่นเล็ก × ราคา)"
                  action={
                    <Button
                      size="small"
                      icon={<BarChartOutlined />}
                      onClick={() => openTopComparison("companies")}
                    >
                      เปรียบเทียบ
                    </Button>
                  }
                >
                  <HorizontalRankChart
                    items={data?.topCompanies || []}
                    height={300}
                    renderMeta={(item) => {
                      const amount = item.reject_amount ?? item.claim_amount;
                      return amount == null ? null : `มูลค่า Reject ${money(amount)} บาท`;
                    }}
                  />
                </Panel>
              </div>
            </Col>
          </Row>
        </section>

        {/* 6) Machine comparison matrix — sheets / value / weight per machine */}
        <section>
          <SectionTitle>6) ตารางเทียบข้อมูลตามเครื่องจักร</SectionTitle>
          <Panel
            title="Reject · ทำลาย BL · ส่งคืนลูกค้า แยกตามเครื่อง"
            subtitle="เลือกรายวัน / รายสัปดาห์ / รายเดือน · แถวล่าสุดคือช่วงปัจจุบัน · ใช้ตัวกรองเดียวกับ Dashboard"
          >
            <MachineComparisonPanel
              period={period}
              from={customFrom}
              to={customTo}
              machineIds={machineIds}
              departmentIds={departmentIds}
              shifts={shifts}
              jobTypes={jobTypes}
            />
          </Panel>
        </section>

        {/* 7) Machines — full width; no agency Top ranking */}
        <section>
          <SectionTitle>7) เครื่องจักรที่ติดปัญหา</SectionTitle>
          <Panel title="เปรียบเทียบจำนวน Reject ตามเครื่อง" subtitle="เรียงจากเครื่องที่มีปัญหาบ่อยสุด">
            <VerticalRankChart items={data?.machines || []} height={300} />
          </Panel>
        </section>

        {/* 8) Per-machine top 3 */}
        <section>
          <SectionTitle>8) Top 3 ปัญหาของแต่ละเครื่อง</SectionTitle>
          <Panel
            title="เจาะลึกตามเครื่อง"
            subtitle={
              machineIds.length === 1
                ? `กำลังโฟกัสเครื่อง ${
                    filterOpts.machineOptions?.find((item) => item.id === machineIds[0])?.name ||
                      machineIds[0]
                  }`
                : machineIds.length > 1
                  ? `กำลังกรอง ${machineIds.length} เครื่อง`
                  : "สลับแท็บเพื่อดู Top 3 ของเครื่องนั้น"
            }
          >
            {machinePanels.length ? (
              <Tabs
                size="small"
                activeKey={machineTab || String(machinePanels[0]?.id)}
                onChange={setMachineTab}
                items={machinePanels.map((machine) => ({
                  key: String(machine.id),
                  label: (
                    <span>
                      {machine.name}
                      <span className="ml-1 text-slate-400">
                        ({Number(machine.count || 0).toLocaleString("th-TH")} ครั้ง)
                      </span>
                    </span>
                  ),
                  children: (
                    <div className="pt-2">
                      <VerticalRankChart
                        items={machine.topProblems || []}
                        height={300}
                        emptyText="ไม่มีปัญหาในเครื่องนี้"
                      />
                    </div>
                  ),
                }))}
              />
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
            )}
          </Panel>
        </section>
        </div>
      </Spin>
    </div>
  );
}
