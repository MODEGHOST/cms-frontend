import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  InputNumber,
  Modal,
  Radio,
  Spin,
  Table,
  Tooltip,
  message,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  SettingOutlined,
} from "@ant-design/icons";
import { complaintDashboardApi, dashboardApi } from "../../services/api";
import { formatDate } from "../../utils/datetime";

const GRAINS = [
  { value: "month", label: "รายเดือน" },
  { value: "week", label: "รายสัปดาห์" },
];

const COPY = {
  reject: {
    totalLabel: "รวม % REJECT",
    caseNoun: "Reject",
  },
  complaint: {
    totalLabel: "รวม % COMPLAINT",
    caseNoun: "Complaint",
  },
};

function fmtPct(value, digits = 2) {
  return `${Number(value || 0).toFixed(digits)}%`;
}

function StatusCell({ status, label }) {
  const onTarget = status === "on_target";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap ${
        onTarget ? "text-emerald-600" : "text-red-600"
      }`}
    >
      {onTarget ? <CheckCircleFilled /> : <CloseCircleFilled />}
      {label}
    </span>
  );
}

function VarianceCell({ value }) {
  const n = Number(value || 0);
  const sign = n > 0 ? "+" : "";
  const color =
    n > 1e-12 ? "text-red-600" : n < -1e-12 ? "text-emerald-600" : "text-slate-500";
  return (
    <span className={`text-[12px] font-bold tabular-nums ${color}`}>
      {sign}
      {fmtPct(n)}
    </span>
  );
}

/**
 * % by department vs NEW TARGET.
 * Grain filter matches OrderRateComparisonTable: month columns vs week columns.
 */
export function DeptTargetRateTable({ kind = "reject" }) {
  const copy = COPY[kind] || COPY.reject;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [grain, setGrain] = useState("week");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftTargets, setDraftTargets] = useState({});
  const [saving, setSaving] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const api = kind === "complaint" ? complaintDashboardApi : dashboardApi;
        const payload = await api.getDeptTargetRate({ grain });
        if (!alive) return;
        setData(payload);
      } catch (err) {
        if (alive) setError(err.message || "โหลดตารางไม่สำเร็จ");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [kind, grain, reloadToken]);

  const openSettings = () => {
    const next = {};
    for (const row of data?.rows || []) {
      next[row.key] = Number(row.target_pct || 0);
    }
    setDraftTargets(next);
    setSettingsOpen(true);
  };

  const draftTotal = useMemo(
    () =>
      Object.values(draftTargets).reduce(
        (sum, value) => sum + Number(value || 0),
        0,
      ),
    [draftTargets],
  );

  const saveTargets = async () => {
    const targets = (data?.rows || []).map((row) => ({
      key: row.key,
      target_pct: Number(draftTargets[row.key] ?? row.target_pct ?? 0),
    }));
    setSaving(true);
    try {
      const api = kind === "complaint" ? complaintDashboardApi : dashboardApi;
      await api.updateDeptTargets({ targets });
      message.success("บันทึก Target แล้ว");
      setSettingsOpen(false);
      setReloadToken((n) => n + 1);
    } catch (err) {
      message.error(err.message || "บันทึก Target ไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const activeGrain = data?.grain || grain;
  const periods = data?.periods || data?.weeks || [];
  const avgLabel =
    data?.avg_label || (activeGrain === "month" ? "เฉลี่ย 4 เดือน" : "เฉลี่ย 4 สัปดาห์");

  const tableRows = useMemo(() => {
    const rows = data?.rows || [];
    const body = rows.map((row) => {
      const values = row.periods || row.weeks || [];
      return {
        ...row,
        periodMap: Object.fromEntries(values.map((item) => [item.key, item])),
        status_label: row.label,
      };
    });

    if (data?.total) {
      const values = data.total.periods || data.total.weeks || [];
      body.push({
        ...data.total,
        isTotal: true,
        periodMap: Object.fromEntries(values.map((item) => [item.key, item])),
        status_label: data.total.label,
      });
    }
    return body;
  }, [data]);

  const relatedSpans = useMemo(() => buildRelatedRowSpans(tableRows), [tableRows]);

  const columns = useMemo(() => {
    const periodCols = periods.map((period) => ({
      title: (
        <Tooltip title={`${formatDate(period.from)} – ${formatDate(period.to)}`}>
          <div className="text-center leading-tight">
            <div className="text-[11px] font-bold tracking-tight">
              {period.short_label || period.label}
            </div>
            {period.current ? (
              <div className="text-[9px] font-semibold text-amber-200">ล่าสุด</div>
            ) : (
              <div className="text-[9px] font-medium opacity-70">%</div>
            )}
          </div>
        </Tooltip>
      ),
      dataIndex: ["periodMap", period.key],
      key: `${activeGrain}-${period.key}`,
      width: "7%",
      align: "center",
      className: period.current ? "dtr-latest" : undefined,
      render: (value) => (
        <Tooltip
          title={`${qtyCases(value?.cases)} ครั้ง · ใบสั่ง ${Number(value?.orders || 0).toLocaleString("th-TH")}`}
        >
          <span
            className={`text-[12px] font-bold tabular-nums ${
              Number(value?.rate_pct) > 0 ? "text-slate-800" : "text-slate-400"
            }`}
          >
            {fmtPct(value?.rate_pct)}
          </span>
        </Tooltip>
      ),
    }));

    return [
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight">หน่วยงาน</div>
        ),
        key: "related",
        width: "9%",
        className: "dtr-related",
        onCell: (row, index) => {
          if (row.isTotal) return { colSpan: 3, className: "dtr-related" };
          const span = relatedSpans[index] ?? 1;
          if (span === 0) return { rowSpan: 0 };
          return { rowSpan: span, className: "dtr-related" };
        },
        render: (_value, row) => {
          if (row.isTotal) {
            return (
              <span className="text-[12px] font-bold text-slate-900">{copy.totalLabel}</span>
            );
          }
          return (
            <span className="text-[12px] font-bold text-slate-800">{row.related}</span>
          );
        },
      },
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight">รับผิดชอบ</div>
        ),
        key: "responsible",
        width: "10%",
        className: "dtr-responsible",
        onCell: (row) => {
          if (row.isTotal) return { colSpan: 0 };
          return { className: "dtr-responsible" };
        },
        render: (_value, row) => {
          if (row.isTotal) return null;
          return (
            <Tooltip title={row.responsible}>
              <span className="block truncate text-[11px] font-semibold text-slate-700">
                {row.responsible}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight">ปัญหา</div>
        ),
        key: "issue",
        width: "13%",
        className: "dtr-issue",
        onCell: (row) => {
          if (row.isTotal) return { colSpan: 0 };
          return { className: "dtr-issue" };
        },
        render: (_value, row) => {
          if (row.isTotal) return null;
          return (
            <Tooltip title={row.issue}>
              <span className="block truncate text-[11px] leading-snug text-slate-600">
                {row.issue}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight text-amber-950">
            New Target
          </div>
        ),
        dataIndex: "target_pct",
        key: "target_pct",
        width: "7.5%",
        align: "center",
        className: "dtr-target",
        render: (value) => (
          <span className="text-[12px] font-bold tabular-nums text-amber-900">
            {fmtPct(value)}
          </span>
        ),
      },
      ...periodCols,
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight text-sky-950">
            เฉลี่ย
          </div>
        ),
        dataIndex: "monthly_avg_pct",
        key: "monthly_avg_pct",
        width: "7%",
        align: "center",
        className: "dtr-avg",
        render: (value) => (
          <span className="text-[12px] font-bold tabular-nums text-sky-900">
            {fmtPct(value)}
          </span>
        ),
      },
      {
        title: (
          <div className="text-center text-[11px] font-bold leading-tight">
            Δ Target
          </div>
        ),
        dataIndex: "variance_pct",
        key: "variance_pct",
        width: "7%",
        align: "center",
        render: (value) => <VarianceCell value={value} />,
      },
      {
        title: <div className="text-center text-[11px] font-bold">สถานะ</div>,
        dataIndex: "status",
        key: "status",
        width: "10%",
        align: "center",
        render: (_value, row) => (
          <StatusCell status={row.status} label={row.label || row.status_label} />
        ),
      },
    ];
  }, [periods, copy.totalLabel, activeGrain, relatedSpans]);

  const syncedText = data?.last_synced_at
    ? `ใบสั่งอัปเดตล่าสุด ${formatDate(data.last_synced_at, "DD/MM/YYYY HH:mm")}`
    : null;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Radio.Group
            size="small"
            optionType="button"
            buttonStyle="solid"
            value={grain}
            options={GRAINS}
            onChange={(event) => setGrain(event.target.value)}
          />
          <Button
            size="small"
            icon={<SettingOutlined />}
            onClick={openSettings}
            disabled={!data?.rows?.length}
            className="!border-amber-300 !bg-amber-50 !text-amber-900 hover:!border-amber-400 hover:!bg-amber-100"
          >
            ตั้งค่า Target
          </Button>
        </div>
        <div className="text-[11px] font-medium text-slate-500">
          {avgLabel} · New Target{" "}
          <span className="font-semibold text-amber-800">{fmtPct(data?.total?.target_pct)}</span>
          {syncedText ? <span className="text-slate-400"> · {syncedText}</span> : null}
        </div>
      </div>

      {error ? <Alert type="error" showIcon message={error} /> : null}

      <style>{`
        .dept-target-rate-table {
          width: 100%;
        }
        .dept-target-rate-table .ant-table {
          table-layout: fixed !important;
        }
        .dept-target-rate-table .ant-spin-nested-loading,
        .dept-target-rate-table .ant-spin-container,
        .dept-target-rate-table .ant-table-container,
        .dept-target-rate-table .ant-table-content,
        .dept-target-rate-table .ant-table-body {
          overflow: visible !important;
          max-height: none !important;
        }
        .dept-target-rate-table table {
          width: 100% !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th {
          background: #1e3a5f !important;
          color: #fff !important;
          padding: 8px 4px !important;
          white-space: nowrap;
          border: 1px solid #334155 !important;
          border-bottom: 1px solid #334155 !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-target {
          background: #f59e0b !important;
          color: #78350f !important;
          border-color: #d97706 !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-avg {
          background: #0ea5e9 !important;
          color: #0c4a6e !important;
          border-color: #0284c7 !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-latest {
          background: #254a73 !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th::before {
          display: none !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td {
          padding: 8px 4px !important;
          vertical-align: middle;
          border: 1px solid #cbd5e1 !important;
        }
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-related,
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-responsible,
        .dept-target-rate-table .ant-table-thead > tr > th.dtr-issue {
          background: #1e3a5f !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-related {
          background: #f8fafc;
          text-align: center;
          vertical-align: middle;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-responsible {
          background: #fff;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-issue {
          background: #fafafa;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td.dtr-related {
          background: #f1f5f9 !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td.dtr-responsible {
          background: #f8fafc !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td.dtr-issue {
          background: #f1f5f9 !important;
        }
        .dept-target-rate-table .ant-table-row-total > td.dtr-related {
          background: #f1f5f9 !important;
          text-align: left;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-target {
          background: #fffbeb;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-avg {
          background: #f0f9ff;
        }
        .dept-target-rate-table .ant-table-tbody > tr > td.dtr-latest {
          background: #fff7ed;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td {
          background: #f8fafc !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td.dtr-target {
          background: #fef3c7 !important;
        }
        .dept-target-rate-table .ant-table-tbody > tr:hover > td.dtr-avg {
          background: #e0f2fe !important;
        }
        .dept-target-rate-table .ant-table-row-total > td {
          background: #f1f5f9 !important;
          border-top: 2px solid #94a3b8 !important;
        }
        .dept-target-rate-table .ant-table-row-total > td.dtr-target {
          background: #fde68a !important;
        }
        .dept-target-rate-table .ant-table-row-total > td.dtr-avg {
          background: #bae6fd !important;
        }
        .dept-target-rate-table .ant-table-row-total > td.dtr-latest {
          background: #ffedd5 !important;
        }
      `}</style>

      <div className="overflow-visible">
        <Spin spinning={loading}>
          {data ? (
            <Table
              className="dept-target-rate-table"
              size="small"
              rowKey="key"
              pagination={false}
              tableLayout="fixed"
              dataSource={tableRows}
              columns={columns}
              rowClassName={(row) => (row.isTotal ? "ant-table-row-total" : "")}
              locale={{ emptyText: "ไม่มีข้อมูลในช่วงนี้" }}
            />
          ) : !loading ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ไม่มีข้อมูลในช่วงนี้" />
          ) : (
            <div className="flex justify-center py-10">
              <Spin />
            </div>
          )}
        </Spin>
      </div>

      <div className="text-[10px] text-slate-400">
        โฮเวอร์ที่ % เพื่อดูจำนวนครั้ง/ใบสั่ง · Sale support ยังไม่มีใน Master จึงเป็น 0%
      </div>

      <Modal
        title={
          <span className="inline-flex items-center gap-2">
            <SettingOutlined className="text-amber-600" />
            ตั้งค่า Target % {kind === "complaint" ? "Complaint" : "Reject"}
          </span>
        }
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        destroyOnHidden
        centered
        width={920}
        footer={[
          <Button key="cancel" onClick={() => setSettingsOpen(false)}>
            ยกเลิก
          </Button>,
          <Button key="save" type="primary" loading={saving} onClick={saveTargets}>
            บันทึก
          </Button>,
        ]}
      >
        <div className="space-y-3 py-1">
          <div className="text-[12px] text-slate-500">
            ปรับ Target ของแต่ละหน่วยงานได้ตลอด · รวม Target จะคำนวณอัตโนมัติ
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(data?.rows || []).map((row) => (
              <div
                key={row.key}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-bold text-slate-800">
                    {row.related}
                  </div>
                  <div className="truncate text-[12px] font-medium text-slate-600">
                    รับผิดชอบ: {row.responsible}
                  </div>
                  <div className="line-clamp-2 text-[11px] leading-snug text-slate-500">
                    ปัญหา: {row.issue}
                  </div>
                </div>
                <div className="mt-auto flex items-center gap-1.5">
                  <InputNumber
                    min={0}
                    max={100}
                    step={0.01}
                    precision={2}
                    value={draftTargets[row.key]}
                    onChange={(value) =>
                      setDraftTargets((prev) => ({
                        ...prev,
                        [row.key]: value == null ? 0 : Number(value),
                      }))
                    }
                    className="!w-full"
                  />
                  <span className="shrink-0 text-[12px] font-semibold text-slate-500">%</span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
            <span className="text-[13px] font-bold text-amber-950">รวม Target</span>
            <span className="text-[14px] font-bold tabular-nums text-amber-900">
              {fmtPct(draftTotal)}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function qtyCases(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

/** Merge consecutive rows that share the same related (e.g. Marketing). */
function buildRelatedRowSpans(rows) {
  const spans = Array(rows.length).fill(1);
  let i = 0;
  while (i < rows.length) {
    if (rows[i]?.isTotal) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (
      j < rows.length &&
      !rows[j]?.isTotal &&
      String(rows[j]?.related || "") === String(rows[i]?.related || "")
    ) {
      j += 1;
    }
    const span = j - i;
    spans[i] = span;
    for (let k = i + 1; k < j; k += 1) spans[k] = 0;
    i = j;
  }
  return spans;
}
