import { useEffect, useMemo, useState } from "react";
import { Alert, Empty, Radio, Spin, Table, Tooltip } from "antd";
import {
  CheckCircleOutlined,
  MinusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { complaintDashboardApi, dashboardApi } from "../../services/api";
import { cacheGetOrSet, cacheKey } from "../../utils/dashboardCache";
import { formatDate } from "../../utils/datetime";
import { pct, qty } from "../../utils/format";

const GRAINS = [
  { value: "month", label: "รายเดือน" },
  { value: "week", label: "รายสัปดาห์" },
  { value: "day", label: "รายวัน" },
];

const GRAIN_NOUN = { day: "วัน", week: "สัปดาห์", month: "เดือน" };

const PERIOD_OPTIONS = {
  month: [
    { value: 1, label: "เดือนนี้" },
    { value: 3, label: "3 เดือน" },
    { value: 6, label: "6 เดือน" },
  ],
  week: [
    { value: 1, label: "สัปดาห์นี้" },
    { value: 3, label: "3 สัปดาห์" },
    { value: 6, label: "6 สัปดาห์" },
  ],
  day: [{ value: 7, label: "สัปดาห์นี้" }],
};

const DEFAULT_COUNT = { month: 3, week: 3, day: 7 };

function windowKey(grain, count) {
  const n = Number(count);
  if (grain === "day") return "day";
  if (n === 1) return grain;
  return `${grain}${n}`;
}

const ROWS = [
  { key: "pdr", label: "PDR", hint: "ใบแผ่น" },
  { key: "pdw", label: "PDW", hint: "ใบกล่อง" },
  {
    key: "total",
    label: "รวม",
    hint: "PDC + PDD + PDF + PDO + PDP + PDR + PDS + PDW + PDZ",
  },
];

const COPY = {
  reject: {
    caseNoun: "Reject",
    formula: "จำนวนครั้ง · % · จำนวนใบสั่ง",
  },
  complaint: {
    caseNoun: "Complaint",
    formula: "จำนวนครั้ง · % · จำนวนใบสั่ง",
  },
};

const STATUS_META = {
  improved: {
    label: "ดีขึ้น",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  flat: {
    label: "ทรงตัว",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  worse: {
    label: "ต้องปรับปรุง",
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function StatusPill({ status, delta, grainNoun, baselineLabel }) {
  const meta = STATUS_META[status] || STATUS_META.flat;
  const sign = delta > 0 ? "+" : "";
  return (
    <Tooltip
      title={`เทียบจาก${grainNoun}ที่แล้ว${baselineLabel ? ` (${baselineLabel})` : ""} · ผลต่าง ${sign}${pct(delta)}`}
    >
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${meta.className}`}
      >
        {status === "improved" ? <CheckCircleOutlined /> : null}
        {status === "worse" ? <WarningOutlined /> : null}
        {status === "flat" ? <MinusOutlined /> : null}
        {meta.label}
        <span className="tabular-nums opacity-80">
          {sign}
          {pct(delta)}
        </span>
      </span>
    </Tooltip>
  );
}

function RateCell({ value, highlight }) {
  const cases = Number(value?.cases || 0);
  const orders = Number(value?.orders || 0);
  const rate = Number(value?.rate || 0);
  if (!orders && !cases) {
    return <span className="text-[13px] text-slate-400">—</span>;
  }
  return (
    <div className="leading-snug">
      <div
        className={`text-[15px] font-bold tabular-nums ${highlight ? "text-red-700" : "text-slate-900"}`}
      >
        {qty(cases, 0)}{" "}
        <span className="text-[11px] font-semibold text-slate-600">ครั้ง</span>
      </div>
      <div
        className={`text-[13px] font-bold tabular-nums ${highlight ? "text-red-700" : "text-slate-700"}`}
      >
        {orders ? pct(rate) : "—"}
      </div>
      <div className="text-[11px] font-medium tabular-nums text-slate-500">
        {qty(orders, 0)} ใบ
      </div>
    </div>
  );
}

export function OrderRateComparisonTable({ kind = "reject", filters = {} }) {
  const copy = COPY[kind] || COPY.reject;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [grain, setGrain] = useState("month");
  const [periodsCount, setPeriodsCount] = useState(DEFAULT_COUNT.month);
  const filterKey = JSON.stringify(filters || {});

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const api = kind === "complaint" ? complaintDashboardApi : dashboardApi;
        const payload = await cacheGetOrSet(cacheKey(`${kind}-order-rate`, filters), () =>
          api.getOrderRate(filters),
        );
        if (alive) setData(payload);
      } catch (err) {
        if (alive) setError(err.message || "โหลดตารางเทียบไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, filterKey]);

  const selected =
    (data?.windows || []).find((item) => item.key === windowKey(grain, periodsCount)) || null;
  const periods = selected?.periods || [];
  const latestKey = periods.find((item) => item.current)?.key || periods[periods.length - 1]?.key;
  const compareNoun = (selected?.compare_grain || grain) === "month" ? "เดือน" : "สัปดาห์";
  const grainNoun = GRAIN_NOUN[grain] || "ช่วง";

  function handleGrainChange(nextGrain) {
    setGrain(nextGrain);
    setPeriodsCount(DEFAULT_COUNT[nextGrain] ?? 3);
  }

  const tableRows = useMemo(() => {
    if (!selected) return [];
    return ROWS.map((row) => ({
      ...row,
      values: Object.fromEntries(
        periods.map((period) => [
          period.key,
          {
            cases: period.cases?.[row.key] || 0,
            orders: period.orders?.[row.key] || 0,
            rate: period.rate_pct?.[row.key] || 0,
          },
        ]),
      ),
      total_cases: selected.cases?.[row.key] || 0,
      total_orders: selected.orders?.[row.key] || 0,
      total_rate: selected.rate_pct?.[row.key] || 0,
      status: selected.status?.[row.key] || { status: "flat", delta: 0 },
    }));
  }, [selected, periods]);

  const columns = useMemo(
    () => [
      {
        title: "ประเภทใบ",
        dataIndex: "label",
        key: "label",
        fixed: "left",
        width: 110,
        render: (value, row) => (
          <div>
            <div className="text-[13px] font-bold text-slate-900">{value}</div>
            <div className="text-[11px] text-slate-500">{row.hint}</div>
          </div>
        ),
      },
      ...periods.map((period) => ({
        title: (
          <div className="leading-tight">
            <div className={period.key === latestKey ? "font-bold text-amber-200" : "font-semibold"}>
              {period.short_label}
            </div>
            <div className="text-[10px] font-normal opacity-70">
              {period.current ? "ล่าสุด" : selected?.grain === "day" ? "" : period.label}
            </div>
          </div>
        ),
        key: period.key,
        align: "center",
        width: 120,
        className: period.key === latestKey ? "ort-latest" : undefined,
        render: (_value, row) => (
          <RateCell value={row.values?.[period.key]} highlight={period.key === latestKey} />
        ),
      })),
      {
        title: "รวมช่วงนี้",
        key: "total",
        align: "center",
        width: 120,
        render: (_value, row) => (
          <RateCell
            value={{ cases: row.total_cases, orders: row.total_orders, rate: row.total_rate }}
          />
        ),
      },
      {
        title: "สถานะล่าสุด",
        key: "status",
        align: "center",
        width: 170,
        render: (_value, row) => (
          <StatusPill
            status={row.status?.status}
            delta={row.status?.delta}
            grainNoun={compareNoun}
            baselineLabel={selected?.baseline?.short_label}
          />
        ),
      },
    ],
    [periods, latestKey, compareNoun, selected?.baseline?.short_label, selected?.grain],
  );

  const syncedText = data?.last_synced_at
    ? `ใบสั่งอัปเดตล่าสุด ${formatDate(data.last_synced_at, "DD/MM/YYYY HH:mm")}`
    : "ยังไม่มีข้อมูลใบสั่งในตาราง";

  const rangeText = selected
    ? `ช่วงเทียบ ${formatDate(selected.from)} → ${formatDate(selected.to)} · สถานะเทียบช่วงเท่ากันกับ${compareNoun}ก่อนหน้า${
        selected.baseline?.short_label ? ` (${selected.baseline.short_label}` : ""
      }${selected.baseline?.from && selected.baseline?.to ? ` ${formatDate(selected.baseline.from)}–${formatDate(selected.baseline.to)}` : ""}${
        selected.baseline?.short_label ? ")" : ""
      }`
    : "";

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        .order-rate-table .ant-table-thead > tr > th {
          background: #0f172a !important;
          color: #ffffff !important;
          font-size: 12px;
          padding: 8px !important;
          border-color: #1e293b !important;
        }
        .order-rate-table .ant-table-thead > tr > th.ant-table-cell-fix-left {
          z-index: 2;
        }
        .order-rate-table .ant-table-thead > tr > th::before { display: none !important; }
        .order-rate-table .ant-table-tbody > tr > td { padding: 8px !important; }
        .order-rate-table .ort-latest { background-color: #fff7ed; }
        .order-rate-table .ant-table-thead > tr > th.ort-latest {
          background: #7f1d1d !important;
        }
        .order-rate-table .ant-table-row-total > td { background: #fff7ed; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Radio.Group
          size="small"
          optionType="button"
          buttonStyle="solid"
          value={grain}
          options={GRAINS}
          onChange={(event) => handleGrainChange(event.target.value)}
        />
        {PERIOD_OPTIONS[grain]?.length > 1 ? (
          <Radio.Group
            size="small"
            value={periodsCount}
            options={PERIOD_OPTIONS[grain]}
            onChange={(event) => setPeriodsCount(Number(event.target.value))}
          />
        ) : (
          <Tooltip title="อ่านจาก order_daily_count ตามวันตีบิล · ไม่ดึง ERP ตอนเปิดหน้า">
            <div className="text-[11px] font-medium text-slate-500">{syncedText}</div>
          </Tooltip>
        )}
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        <div className="flex flex-col gap-2">
          {rangeText ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-5 font-medium text-slate-700">
              {rangeText}
              {" · "}แต่ละช่อง = {copy.formula}
              {data?.denominator_note ? ` · ${data.denominator_note}` : ""}
              {PERIOD_OPTIONS[grain]?.length > 1 ? (
                <span className="ml-2 text-[11px] font-normal text-slate-500">{syncedText}</span>
              ) : null}
            </div>
          ) : null}

          {selected ? (
            <Table
              className="order-rate-table"
              size="small"
              rowKey="key"
              pagination={false}
              columns={columns}
              dataSource={tableRows}
              scroll={{ x: 400 + periods.length * 120 }}
              rowClassName={(row) => (row.key === "total" ? "ant-table-row-total" : "")}
            />
          ) : !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
          ) : null}
        </div>
      </Spin>
    </div>
  );
}
