import { useEffect, useMemo, useState } from "react";
import { Alert, Empty, Radio, Segmented, Spin, Table, Tooltip } from "antd";
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CheckCircleOutlined,
  MinusOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { complaintDashboardApi } from "../../services/api";
import { qty } from "../../utils/format";

const DIMENSIONS = [
  { value: "department", label: "หน่วยงาน" },
  { value: "problem", label: "ปัญหา" },
  { value: "company", label: "ลูกค้า" },
  { value: "machine", label: "เครื่องจักร" },
];

const GRAINS = [
  { value: "month", label: "รายเดือน" },
  { value: "week", label: "รายสัปดาห์" },
  { value: "day", label: "รายวัน" },
];

const GRAIN_NOUN = { day: "วัน", week: "สัปดาห์", month: "เดือน" };
const DEFAULT_PERIODS = { day: 14, week: 4, month: 6 };

const DIMENSION_HEADER = {
  department: "หน่วยงานที่รับผิดชอบ",
  problem: "ปัญหาที่ร้องเรียน",
  company: "ลูกค้าที่ร้องเรียน",
  machine: "เครื่องจักร",
};

const STATUS_META = {
  improved: {
    label: "ดีขึ้น",
    icon: <ArrowDownOutlined />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  flat: {
    label: "ทรงตัว",
    icon: <MinusOutlined />,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  worse: {
    label: "ต้องปรับปรุง",
    icon: <ArrowUpOutlined />,
    className: "border-red-200 bg-red-50 text-red-700",
  },
};

function StatusPill({ status, delta }) {
  const meta = STATUS_META[status] || STATUS_META.flat;
  const sign = delta > 0 ? "+" : "";
  return (
    <Tooltip title={`ช่วงล่าสุดต่างจากค่าเฉลี่ยย้อนหลัง ${sign}${qty(delta, 1)} ครั้ง`}>
      <span
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${meta.className}`}
      >
        {status === "improved" ? <CheckCircleOutlined /> : null}
        {status === "worse" ? <WarningOutlined /> : null}
        {meta.label}
        <span className="tabular-nums opacity-80">
          {sign}
          {qty(delta, 1)}
        </span>
      </span>
    </Tooltip>
  );
}

function CountCell({ value, highlight }) {
  const count = Number(value?.count || 0);
  if (!count) {
    return <span className="text-[13px] text-slate-300">—</span>;
  }
  return (
    <div className="leading-tight">
      <div
        className={`text-[14px] font-bold tabular-nums ${highlight ? "text-red-700" : "text-slate-900"}`}
      >
        {qty(count, 0)}
      </div>
      <div className="text-[10px] tabular-nums text-slate-400">{value.share_pct}%</div>
    </div>
  );
}

/**
 * The executive comparison matrix: one row per entity, one column per month /
 * week / day bucket, with a verdict on the latest bucket. Department, company
 * and machine rows expand into the problems behind them.
 */
export function ComplaintSummaryTable({
  period,
  from,
  to,
  departmentIds = [],
  problemIds = [],
  companyIds = [],
  machineIds = [],
  fluteIds = [],
  grades = [],
  shifts = [],
  statuses = [],
}) {
  const [dimension, setDimension] = useState("department");
  const [grain, setGrain] = useState("month");
  const [periodsCount, setPeriodsCount] = useState(DEFAULT_PERIODS.month);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const result = await complaintDashboardApi.getSummaryTable({
          dimension,
          grain,
          periods: periodsCount,
          period,
          from: period === "custom" ? from : undefined,
          to: period === "custom" ? to : undefined,
          department_ids: departmentIds.length ? departmentIds.join(",") : undefined,
          problem_ids: problemIds.length ? problemIds.join(",") : undefined,
          company_ids: companyIds.length ? companyIds.join(",") : undefined,
          machine_ids: machineIds.length ? machineIds.join(",") : undefined,
          flute_ids: fluteIds.length ? fluteIds.join(",") : undefined,
          grades: grades.length ? grades.join(",") : undefined,
          shifts: shifts.length ? shifts.join(",") : undefined,
          statuses: statuses.length ? statuses.join(",") : undefined,
        });
        if (alive) setData(result);
      } catch (err) {
        if (alive) setError(err.message || "โหลดตารางสรุปไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [
    dimension,
    grain,
    periodsCount,
    period,
    from,
    to,
    departmentIds,
    problemIds,
    companyIds,
    machineIds,
    fluteIds,
    grades,
    shifts,
    statuses,
  ]);

  function handleGrainChange(nextGrain) {
    setGrain(nextGrain);
    setPeriodsCount(DEFAULT_PERIODS[nextGrain] ?? 6);
  }

  const periods = useMemo(() => data?.periods || [], [data]);
  const noun = GRAIN_NOUN[data?.grain || grain] || "ช่วง";

  // Expanding a problem row into problems would just repeat itself.
  const rows = useMemo(() => {
    const source = data?.rows || [];
    if (data?.dimension === "problem") {
      return source.map(({ children: _children, ...row }) => row);
    }
    return source;
  }, [data]);

  const columns = useMemo(() => {
    if (!periods.length) return [];
    const lastKey = periods[periods.length - 1].key;

    return [
      {
        title: DIMENSION_HEADER[data?.dimension || dimension],
        dataIndex: "name",
        key: "name",
        fixed: "left",
        width: 260,
        render: (value, row) => (
          <div className="min-w-0">
            <div className="text-[13px] leading-5 font-semibold break-words text-slate-900">
              {value}
            </div>
            {row.name_en ? (
              <div className="text-[11px] leading-4 text-slate-400">{row.name_en}</div>
            ) : null}
            {row.top_problems?.length ? (
              <div className="mt-1 text-[11px] leading-4 break-words text-slate-500">
                {row.top_problems.join(" · ")}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        title: (
          <Tooltip title={`ค่าเฉลี่ยของ ${periods.length - 1} ${noun}ก่อนหน้า ใช้เป็นเกณฑ์เทียบ`}>
            <span>เกณฑ์เฉลี่ย</span>
          </Tooltip>
        ),
        dataIndex: "avg_count",
        key: "avg_count",
        align: "center",
        width: 90,
        render: (value) => (
          <span className="text-[13px] font-semibold tabular-nums text-sky-700">
            {qty(value, 1)}
          </span>
        ),
      },
      ...periods.map((item) => ({
        title: (
          <div className="leading-tight">
            <div className={item.key === lastKey ? "font-bold text-amber-300" : "font-semibold"}>
              {item.short_label}
            </div>
            <div className="text-[10px] font-normal opacity-70">
              {item.key === lastKey ? "ล่าสุด" : item.label}
            </div>
          </div>
        ),
        key: item.key,
        align: "center",
        width: 96,
        className: item.key === lastKey ? "cst-latest" : undefined,
        render: (_value, row) => (
          <CountCell
            value={row.values?.find((cell) => cell.period_key === item.key)}
            highlight={item.key === lastKey}
          />
        ),
      })),
      {
        title: "รวม",
        dataIndex: "total_count",
        key: "total_count",
        align: "center",
        width: 90,
        render: (value) => (
          <span className="text-[14px] font-bold tabular-nums text-slate-900">{qty(value, 0)}</span>
        ),
      },
      {
        title: "สถานะล่าสุด",
        key: "status",
        align: "center",
        width: 150,
        render: (_value, row) => <StatusPill status={row.status} delta={row.delta} />,
      },
    ];
  }, [periods, noun, data?.dimension, dimension]);

  const totals = data?.totals;
  const rangeText = data?.filters ? `${data.filters.from} → ${data.filters.to}` : "";

  return (
    <div className="flex flex-col gap-3">
      <style>{`
        .complaint-summary-table .ant-table-thead > tr > th {
          background: #0f172a !important;
          color: #ffffff !important;
          font-size: 12px;
          padding: 8px !important;
          border-color: #1e293b !important;
        }
        .complaint-summary-table .ant-table-thead > tr > th::before { display: none !important; }
        .complaint-summary-table .ant-table-tbody > tr > td { padding: 8px !important; }
        .complaint-summary-table .cst-latest { background-color: #fff7ed; }
        .complaint-summary-table .ant-table-thead > tr > th.cst-latest {
          background: #7f1d1d !important;
        }
        .complaint-summary-table .ant-table-row-level-1 > td:first-child {
          background-color: #f8fafc;
        }
        .complaint-summary-table .ant-table-summary > tr > td {
          background: #1e3a8a !important;
          color: #ffffff !important;
          border-color: #1e40af !important;
          padding: 10px 8px !important;
        }
      `}</style>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="small"
            value={dimension}
            options={DIMENSIONS}
            disabled={loading}
            onChange={setDimension}
          />
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={grain}
            options={GRAINS}
            disabled={loading}
            onChange={(event) => handleGrainChange(event.target.value)}
          />
        </div>
        {data?.periods_options?.length ? (
          <Radio.Group
            size="small"
            value={data.periods_count}
            disabled={loading}
            options={data.periods_options.map((value) => ({
              value,
              label: `${value} ${noun}`,
            }))}
            onChange={(event) => setPeriodsCount(event.target.value)}
          />
        ) : null}
      </div>

      {rangeText ? (
        <div className="text-[11px] text-slate-400">
          ช่วงเทียบ {rangeText} · คอลัมน์สุดท้ายคือ{noun}ล่าสุดที่มีข้อมูล ·
          {data?.dimension === "problem" ? " " : " กดที่แถวเพื่อดูปัญหาย่อย · "}
          ตัวเลขเล็กคือสัดส่วนของ{noun}นั้น
        </div>
      ) : null}

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <Spin spinning={loading}>
        {rows.length && columns.length ? (
          <Table
            size="small"
            bordered
            rowKey="key"
            className="complaint-summary-table"
            dataSource={rows}
            columns={columns}
            pagination={rows.length > 12 ? { pageSize: 12, showSizeChanger: false } : false}
            scroll={{ x: 260 + 90 + periods.length * 96 + 240 }}
            expandable={{ childrenColumnName: "children" }}
            summary={() =>
              totals ? (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0}>
                      <span className="text-[13px] font-bold">
                        รวมทั้งหมด ({rows.length} {DIMENSION_HEADER[data?.dimension] || "รายการ"})
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={1} align="center">
                      <span className="text-[13px] font-semibold tabular-nums">
                        {qty(totals.avg_count, 1)}
                      </span>
                    </Table.Summary.Cell>
                    {periods.map((item, index) => {
                      const cell = totals.values?.find((value) => value.period_key === item.key);
                      return (
                        <Table.Summary.Cell key={item.key} index={2 + index} align="center">
                          <span className="text-[14px] font-bold tabular-nums">
                            {qty(cell?.count, 0)}
                          </span>
                        </Table.Summary.Cell>
                      );
                    })}
                    <Table.Summary.Cell index={2 + periods.length} align="center">
                      <span className="text-[14px] font-bold tabular-nums">
                        {qty(totals.total_count, 0)}
                      </span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3 + periods.length} align="center">
                      <StatusPill status={totals.status} delta={totals.delta} />
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              ) : null
            }
          />
        ) : !loading && !error ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงที่เลือก" />
        ) : (
          <div className="h-[240px]" />
        )}
      </Spin>
    </div>
  );
}
