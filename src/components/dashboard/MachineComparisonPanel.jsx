import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Checkbox, Empty, Popover, Radio, Select, Spin, Table } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  FilterOutlined,
  MinusOutlined,
} from "@ant-design/icons";
import { dashboardApi } from "../../services/api";
import { colorForKey } from "../../utils/colors";
import { qty } from "../../utils/format";

const GRAIN_OPTIONS = [
  { value: "day", label: "รายวัน" },
  { value: "week", label: "รายสัปดาห์" },
  { value: "month", label: "รายเดือน" },
];

const GRAIN_NOUN = { day: "วัน", week: "สัปดาห์", month: "เดือน" };

/**
 * One row per metric. All of these are "lower is better" for executives
 * (reject / scrap cost / customer return).
 */
const METRICS = [
  { key: "claim_sheet_qty", label: "Reject", unit: "แผ่น", format: (value) => qty(value, 0) },
  { key: "reject_amount", label: "มูลค่า Reject", unit: "บาท", format: (value) => qty(value, 2) },
  { key: "reject_weight", label: "น้ำหนัก Reject", unit: "KG", format: (value) => qty(value, 2) },
  {
    key: "destroy_bl_weight",
    label: "น้ำหนักทำลาย BL",
    unit: "KG",
    format: (value) => qty(value, 2),
  },
  {
    key: "destroy_bl_amount",
    label: "จำนวนเงินทำลาย BL",
    unit: "บาท",
    format: (value) => qty(value, 2),
  },
  {
    key: "return_to_customer_qty",
    label: "คัดส่งคืนลูกค้า",
    unit: "แผ่น",
    format: (value) => qty(value, 0),
  },
  {
    key: "return_amount",
    label: "จำนวนเงินที่ส่งคืนลูกค้า",
    unit: "บาท",
    format: (value) => qty(value, 2),
  },
];

const ALL_METRIC_KEYS = METRICS.map((item) => item.key);

const EMPTY_CELL = {
  count: 0,
  claim_sheet_qty: 0,
  reject_amount: 0,
  reject_weight: 0,
  destroy_bl_weight: 0,
  destroy_bl_amount: 0,
  return_to_customer_qty: 0,
  return_amount: 0,
};

function formatBucketLabel(row, grain) {
  const from = new Date(`${row.from}T00:00:00`);
  if (Number.isNaN(from.getTime())) return row.label;
  if (grain === "month") {
    return from.toLocaleDateString("th-TH", { month: "short", year: "2-digit" });
  }
  if (grain === "week") {
    const to = new Date(`${row.to}T00:00:00`);
    const fromText = from.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    const toText = to.toLocaleDateString("th-TH", { day: "numeric", month: "short" });
    return `${fromText}–${toText}`;
  }
  return from.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
}

function sumCells(cells) {
  return cells.reduce(
    (acc, cell) => ({
      count: acc.count + Number(cell?.count || 0),
      claim_sheet_qty: acc.claim_sheet_qty + Number(cell?.claim_sheet_qty || 0),
      reject_amount: acc.reject_amount + Number(cell?.reject_amount || 0),
      reject_weight: acc.reject_weight + Number(cell?.reject_weight || 0),
      destroy_bl_weight: acc.destroy_bl_weight + Number(cell?.destroy_bl_weight || 0),
      destroy_bl_amount: acc.destroy_bl_amount + Number(cell?.destroy_bl_amount || 0),
      return_to_customer_qty:
        acc.return_to_customer_qty + Number(cell?.return_to_customer_qty || 0),
      return_amount: acc.return_amount + Number(cell?.return_amount || 0),
    }),
    { ...EMPTY_CELL },
  );
}

/** Compare current vs previous period. Lower reject/cost = better. */
function getTrend(current, previous) {
  if (previous == null) return null;
  const cur = Number(current || 0);
  const prev = Number(previous || 0);
  if (cur === prev) return { direction: "flat", pct: 0, better: null };
  if (prev === 0) {
    return { direction: cur > 0 ? "up" : "flat", pct: null, better: cur > 0 ? false : null };
  }
  const pct = ((cur - prev) / Math.abs(prev)) * 100;
  const up = cur > prev;
  return { direction: up ? "up" : "down", pct, better: !up };
}

function TrendBadge({ trend }) {
  if (!trend) return null;
  if (trend.direction === "flat") {
    return (
      <span className="trend-badge inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
        <MinusOutlined className="text-[9px]" />
        <span>0%</span>
      </span>
    );
  }
  const good = trend.better === true;
  const bad = trend.better === false;
  const color = good ? "text-emerald-600" : bad ? "text-red-600" : "text-slate-500";
  const Icon = trend.direction === "up" ? ArrowUpOutlined : ArrowDownOutlined;
  const pctText = trend.pct == null ? "ใหม่" : `${Math.abs(trend.pct).toFixed(0)}%`;

  return (
    <span
      className={`trend-badge inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${color}`}
      title={
        good
          ? "ดีกว่าช่วงก่อน (ลดลง)"
          : bad
            ? "แย่กว่าช่วงก่อน (เพิ่มขึ้น)"
            : "เทียบช่วงก่อน"
      }
    >
      <Icon className="text-[10px]" />
      <span>{pctText}</span>
    </span>
  );
}

/** Trend first, then number + unit — group always hugs the right edge. */
function ValueCell({ metric, value, trend, tone = "slate" }) {
  const numberClass = tone === "red" ? "text-red-700" : "text-slate-900";
  return (
    <div className="flex w-full items-baseline justify-end gap-1.5">
      {trend ? <TrendBadge trend={trend} /> : null}
      <span className={`text-[13px] font-bold tabular-nums ${numberClass}`}>
        {metric.format(Number(value || 0))}
      </span>
      <span className="w-7 shrink-0 text-left text-[11px] font-semibold text-slate-900">
        {metric.unit}
      </span>
    </div>
  );
}

function MetricFilterHeader({ selectedKeys, onChange }) {
  const allChecked = selectedKeys.length === ALL_METRIC_KEYS.length;
  const indeterminate = selectedKeys.length > 0 && !allChecked;

  return (
    <div className="flex items-center justify-between gap-1">
      <span className="font-semibold">รายการ</span>
      <Popover
        trigger="click"
        placement="bottomLeft"
        title="เลือกรายการที่ต้องการแสดง"
        content={
          <div className="w-[240px] space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <Checkbox
                indeterminate={indeterminate}
                checked={allChecked}
                onChange={(event) => {
                  if (!event.target.checked) return;
                  onChange([...ALL_METRIC_KEYS]);
                }}
              >
                เลือกทั้งหมด
              </Checkbox>
              {!allChecked ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-red-700 hover:underline"
                  onClick={() => onChange([...ALL_METRIC_KEYS])}
                >
                  คืนค่าเริ่มต้น
                </button>
              ) : null}
            </div>
            <Checkbox.Group
              className="flex flex-col gap-1.5"
              value={selectedKeys}
              options={METRICS.map((item) => ({
                label: item.label,
                value: item.key,
              }))}
              onChange={(keys) => {
                if (keys.length === 0) return;
                onChange(keys);
              }}
            />
            <div className="text-[11px] text-slate-500">ต้องเลือกอย่างน้อย 1 รายการ</div>
          </div>
        }
      >
        <Button
          type="text"
          size="small"
          icon={<FilterOutlined />}
          className={!allChecked ? "!text-red-700" : undefined}
          title="กรองรายการ"
        />
      </Popover>
    </div>
  );
}

function ExecutivePulse({ current, previous, noun }) {
  if (!current || !previous) return null;

  const highlights = [
    { key: "claim_sheet_qty", label: "Reject", format: (v) => `${qty(v, 0)} แผ่น` },
    { key: "reject_amount", label: "มูลค่า Reject", format: (v) => `${qty(v, 2)} บาท` },
    { key: "destroy_bl_amount", label: "เงินทำลาย BL", format: (v) => `${qty(v, 2)} บาท` },
    { key: "return_amount", label: "เงินส่งคืนลูกค้า", format: (v) => `${qty(v, 2)} บาท` },
  ].map((item) => ({
    ...item,
    value: Number(current[item.key] || 0),
    trend: getTrend(current[item.key], previous[item.key]),
  }));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold text-slate-800">
          สรุปช่วงปัจจุบัน เทียบ{noun}ก่อน
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-600">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <ArrowDownOutlined /> ลดลง = ดี
          </span>
          <span className="inline-flex items-center gap-1 text-red-600">
            <ArrowUpOutlined /> เพิ่มขึ้น = ต้องดู
          </span>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {highlights.map((item) => {
          const good = item.trend?.better === true;
          const bad = item.trend?.better === false;
          const tone = good
            ? "border-emerald-200 bg-emerald-50"
            : bad
              ? "border-red-200 bg-red-50"
              : "border-slate-200 bg-white";
          return (
            <div key={item.key} className={`rounded-lg border px-2.5 py-2 ${tone}`}>
              <div className="text-[11px] font-semibold text-slate-600">{item.label}</div>
              <div className="mt-0.5 flex items-baseline justify-end gap-2">
                <TrendBadge trend={item.trend} />
                <span className="text-[15px] font-bold tabular-nums text-slate-900">
                  {item.format(item.value)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MachineComparisonPanel({
  period,
  from,
  to,
  machineIds = [],
  departmentIds = [],
  shifts = [],
  jobTypes = [],
}) {
  const [grain, setGrain] = useState("week");
  const [bucketCount, setBucketCount] = useState(4);
  const [selectedMachineKeys, setSelectedMachineKeys] = useState([]);
  const [selectedMetricKeys, setSelectedMetricKeys] = useState(() => [...ALL_METRIC_KEYS]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await dashboardApi.getMachineComparison({
          grain,
          periods: bucketCount,
          period,
          from: period === "custom" ? from : undefined,
          to: period === "custom" ? to : undefined,
          machine_ids: machineIds.length ? machineIds.join(",") : undefined,
          department_ids: departmentIds.length ? departmentIds.join(",") : undefined,
          shifts: shifts.length ? shifts.join(",") : undefined,
          job_types: jobTypes.length ? jobTypes.join(",") : undefined,
        });
        if (alive) {
          setData(result);
          const nextKeys = (result.machines || []).map((item) => item.key);
          setSelectedMachineKeys((current) => {
            if (!current.length) return nextKeys;
            const allowed = new Set(nextKeys);
            const kept = current.filter((key) => allowed.has(key));
            return kept.length ? kept : nextKeys;
          });
        }
      } catch (err) {
        if (alive) setError(err.message || "โหลดตารางเทียบข้อมูลไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [grain, bucketCount, period, from, to, machineIds, departmentIds, shifts, jobTypes]);

  function handleGrainChange(nextGrain) {
    setGrain(nextGrain);
    // Reset to the default bucket count for the newly selected grain.
    const defaults = { day: 7, week: 4, month: 6 };
    setBucketCount(defaults[nextGrain] ?? 4);
  }

  const allMachines = useMemo(() => data?.machines || [], [data]);
  const selectedKeySet = useMemo(() => new Set(selectedMachineKeys), [selectedMachineKeys]);
  const machines = useMemo(
    () => allMachines.filter((item) => selectedKeySet.has(item.key)),
    [allMachines, selectedKeySet],
  );

  const periodRows = useMemo(() => {
    const source = data?.rows || [];
    if (!machines.length) return [...source].reverse();
    return [...source].reverse().map((row) => {
      const visibleCells = machines.map((machine) => row.cells?.[machine.key] || EMPTY_CELL);
      return { ...row, total: sumCells(visibleCells) };
    });
  }, [data, machines]);

  const totals = useMemo(() => {
    if (!machines.length) return { cells: {}, total: { ...EMPTY_CELL } };
    const cells = Object.fromEntries(
      machines.map((machine) => [
        machine.key,
        data?.totals?.cells?.[machine.key] || { ...EMPTY_CELL },
      ]),
    );
    return { cells, total: sumCells(Object.values(cells)) };
  }, [data, machines]);

  const noun = GRAIN_NOUN[data?.grain || grain] || "ช่วง";
  const allSelected = allMachines.length > 0 && machines.length === allMachines.length;

  const visibleMetrics = useMemo(() => {
    const selected = new Set(selectedMetricKeys);
    return METRICS.filter((item) => selected.has(item.key));
  }, [selectedMetricKeys]);

  /** One table row per period × metric, with the period label spanning its metrics. */
  const tableRows = useMemo(() => {
    const out = [];
    const pushGroup = (group) => {
      visibleMetrics.forEach((metric, metricIndex) => {
        out.push({
          ...group,
          key: `${group.groupKey}__${metric.key}`,
          metric,
          isGroupStart: metricIndex === 0,
          isGroupEnd: metricIndex === visibleMetrics.length - 1,
          rowSpan: metricIndex === 0 ? visibleMetrics.length : 0,
        });
      });
    };

    periodRows.forEach((row, index) => {
      pushGroup({
        groupKey: row.key,
        groupIndex: index,
        row,
        previous: index === 0 ? periodRows[1] : null,
        current: row.current,
        isTotals: false,
      });
    });

    if (periodRows.length) {
      pushGroup({
        groupKey: "__totals",
        groupIndex: periodRows.length,
        row: { ...totals, label: `รวม ${periodRows.length} ${noun}` },
        previous: null,
        current: false,
        isTotals: true,
      });
    }
    return out;
  }, [periodRows, totals, noun, visibleMetrics]);

  const columns = useMemo(
    () => [
      {
        title: `ช่วงเวลา (${noun})`,
        key: "period",
        width: 165,
        onCell: (record) => ({ rowSpan: record.rowSpan }),
        render: (_value, record) => {
          if (record.isTotals) {
            return (
              <span className="text-[15px] font-bold text-slate-900">{record.row.label}</span>
            );
          }
          return (
            <div>
              <div
                className={`text-[16px] leading-5 font-bold ${record.current ? "text-red-700" : "text-slate-900"}`}
              >
                {formatBucketLabel(record.row, data?.grain || grain)}
              </div>
              <div className="mt-1 text-[12px] font-semibold text-slate-700">
                {record.current ? "ปัจจุบัน · " : ""}
                {qty(record.row.total?.count, 0)} ครั้ง
              </div>
            </div>
          );
        },
      },
      {
        title: (
          <MetricFilterHeader
            selectedKeys={selectedMetricKeys}
            onChange={setSelectedMetricKeys}
          />
        ),
        key: "metric",
        width: 170,
        render: (_value, record) => (
          <span className="text-[12px] font-semibold whitespace-nowrap text-slate-800">
            {record.metric.label}
          </span>
        ),
      },
      ...machines.map((machine, index) => ({
        title: (
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: colorForKey(machine.name, index) }}
            />
            <span className="font-semibold">{machine.name}</span>
          </div>
        ),
        key: machine.key,
        render: (_value, record) => (
          <ValueCell
            metric={record.metric}
            value={record.row.cells?.[machine.key]?.[record.metric.key]}
            trend={
              record.previous
                ? getTrend(
                  record.row.cells?.[machine.key]?.[record.metric.key],
                  record.previous.cells?.[machine.key]?.[record.metric.key],
                )
                : null
            }
            tone={record.current ? "red" : "slate"}
          />
        ),
      })),
      {
        title: (
          <span className="font-semibold">
            {allSelected ? "รวมทุกเครื่อง" : `รวม ${machines.length} เครื่อง`}
          </span>
        ),
        key: "total",
        render: (_value, record) => (
          <ValueCell
            metric={record.metric}
            value={record.row.total?.[record.metric.key]}
            trend={
              record.previous
                ? getTrend(
                  record.row.total?.[record.metric.key],
                  record.previous.total?.[record.metric.key],
                )
                : null
            }
            tone={record.current ? "red" : "slate"}
          />
        ),
      },
    ],
    [machines, data?.grain, grain, noun, allSelected, selectedMetricKeys],
  );

  const bucketOptions = (data?.periods_options || []).map((value) => ({
    value,
    label: `${value} ${noun}`,
  }));

  const machineOptions = allMachines.map((machine, index) => ({
    value: machine.key,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: colorForKey(machine.name, index) }}
        />
        {machine.name}
      </span>
    ),
  }));

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        @keyframes trend-pop {
          0% { opacity: 0; transform: translateY(3px) scale(0.92); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .trend-badge { animation: trend-pop 0.35s ease-out both; }
        .machine-comparison-table .ant-table-tbody > tr > td { padding: 4px 8px; }

        /* Alternate the shading per period so each block reads as one unit */
        .machine-comparison-table .mc-group-alt > td { background-color: #f1f5f9; }

        /* Strong rule where a new period starts */
        .machine-comparison-table .mc-group-start > td { border-top: 2px solid #94a3b8; }

        /* Period label sits centred in its merged cell */
        .machine-comparison-table .ant-table-tbody > tr > td:first-child {
          vertical-align: middle;
          background-color: #f8fafc;
        }
        .machine-comparison-table .mc-current > td:first-child { background-color: #fee2e2; }
        .machine-comparison-table .mc-totals > td { background-color: #e2e8f0; }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={grain}
            options={GRAIN_OPTIONS}
            disabled={loading}
            onChange={(event) => handleGrainChange(event.target.value)}
          />
          <Select
            mode="multiple"
            allowClear
            size="small"
            className="min-w-[220px] max-w-full sm:min-w-[280px]"
            placeholder="เลือกเครื่องที่ต้องการแสดง"
            maxTagCount="responsive"
            disabled={loading || !allMachines.length}
            options={machineOptions}
            value={selectedMachineKeys}
            onChange={(keys) => setSelectedMachineKeys(keys)}
            filterOption={(input, option) => {
              const machine = allMachines.find((item) => item.key === option?.value);
              return String(machine?.name || "")
                .toLowerCase()
                .includes(String(input).toLowerCase());
            }}
          />
          {allMachines.length && selectedMachineKeys.length < allMachines.length ? (
            <button
              type="button"
              className="text-[12px] font-medium text-red-700 hover:underline"
              onClick={() => setSelectedMachineKeys(allMachines.map((item) => item.key))}
            >
              แสดงทั้งหมด
            </button>
          ) : null}
        </div>
        {bucketOptions.length ? (
          <Radio.Group
            size="small"
            value={data?.periods_count}
            options={bucketOptions}
            disabled={loading}
            onChange={(event) => setBucketCount(event.target.value)}
          />
        ) : null}
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {machines.length && tableRows.length ? (
          <div className="space-y-3">
            <ExecutivePulse
              current={periodRows[0]?.total}
              previous={periodRows[1]?.total}
              noun={noun}
            />

            <Table
              size="small"
              bordered
              pagination={false}
              tableLayout="fixed"
              rowKey="key"
              dataSource={tableRows}
              columns={columns}
              className="machine-comparison-table w-full"
              rowClassName={(record) => {
                const classes = [];
                if (record.isGroupStart) classes.push("mc-group-start");
                if (record.isTotals) {
                  classes.push("mc-totals", "font-semibold");
                } else if (record.current) {
                  classes.push("mc-current", "bg-red-50/70");
                } else if (record.groupIndex % 2 === 1) {
                  classes.push("mc-group-alt");
                }
                return classes.join(" ");
              }}
            />
          </div>
        ) : !loading && !error ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              allMachines.length && !machines.length
                ? "เลือกอย่างน้อย 1 เครื่องเพื่อแสดงตาราง"
                : "ไม่มีเครื่องจักรที่ตรงกับตัวกรอง"
            }
          />
        ) : (
          <div className="h-[240px]" />
        )}
      </Spin>
    </div>
  );
}
