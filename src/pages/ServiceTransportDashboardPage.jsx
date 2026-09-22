import { useEffect, useMemo, useState } from "react";
import { App, Card, Col, Empty, Radio, Row, Segmented, Spin } from "antd";
import {
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  FileSearchOutlined,
  InboxOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { complaintApi } from "../services/api";
import { COMPLAINT_WORKFLOW_LABELS } from "../constants/complaintWorkflow";
import {
  SERVICE_SCOPE_EXTERNAL,
  SERVICE_SCOPE_INTERNAL,
  serviceTransportListPath,
} from "../constants/serviceTransport";
import { KpiTile, Panel, SectionTitle } from "../components/dashboard/primitives";
import { formatDateRange, formatTodayWithWeekday } from "../utils/datetime";

const PERIODS = [
  { value: "day", label: "วันนี้" },
  { value: "week", label: "สัปดาห์นี้" },
  { value: "month", label: "เดือนนี้" },
  { value: "last_month", label: "เดือนที่แล้ว" },
  { value: "all", label: "ทั้งหมด" },
];

const PERIOD_HINT = {
  day: "วันที่ complaint = วันนี้",
  week: "วันที่ complaint ในสัปดาห์นี้ (อา.–ส.)",
  month: "วันที่ complaint ในเดือนนี้",
  last_month: "วันที่ complaint ในเดือนที่แล้ว",
  all: "ทุกช่วงเวลา",
};

const STATUS_ORDER = [
  "cs_draft",
  "pending_qa",
  "qa_review",
  "pending_department",
  "department_action",
  "qa_confirm",
  "completed",
];

const STATUS_META = {
  cs_draft: { tone: "slate", step: "CS", color: "#64748b" },
  pending_qa: { tone: "amber", step: "QA", color: "#d97706" },
  qa_review: { tone: "orange", step: "QA", color: "#ea580c" },
  pending_department: { tone: "rose", step: "หน่วยงาน", color: "#e11d48" },
  department_action: { tone: "orange", step: "หน่วยงาน", color: "#c2410c" },
  qa_confirm: { tone: "amber", step: "Confirm", color: "#b45309" },
  completed: { tone: "slate", step: "ปิดงาน", color: "#059669" },
};

const SCOPE_TABS = [
  { value: "all", label: "ทั้งหมด" },
  { value: "internal", label: "ร้องเรียนภายใน" },
  { value: "external", label: "ร้องเรียนภายนอก" },
];

function countOf(summary, status) {
  return Number(summary?.by_status?.[status] || 0);
}

function completedPct(summary) {
  const total = Number(summary?.total || 0);
  if (!total) return 0;
  return (countOf(summary, "completed") / total) * 100;
}

function WorkflowPipeline({ summary, onStatusClick }) {
  const total = Number(summary?.total || 0) || 1;
  const items = STATUS_ORDER.map((status) => ({
    status,
    label: COMPLAINT_WORKFLOW_LABELS[status] || status,
    count: countOf(summary, status),
    meta: STATUS_META[status],
  }));

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {items.map((item) => {
          if (!item.count) return null;
          const width = Math.max((item.count / total) * 100, item.count ? 2 : 0);
          return (
            <button
              key={item.status}
              type="button"
              title={`${item.label}: ${item.count}`}
              onClick={() => onStatusClick?.(item.status)}
              className="h-full transition hover:opacity-90"
              style={{ width: `${width}%`, background: item.meta.color }}
            />
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <button
            key={item.status}
            type="button"
            onClick={() => onStatusClick?.(item.status)}
            className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-red-200 hover:bg-white hover:shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
                style={{ background: item.meta.color }}
              >
                {item.meta.step}
              </span>
              <span className="text-lg font-bold tabular-nums text-slate-900">
                {item.count.toLocaleString("th-TH")}
              </span>
            </div>
            <div className="mt-1 truncate text-[12px] font-medium text-slate-600">
              {item.label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ScopeCompareCard({ title, summary, accent, onOpen }) {
  const open = Number(summary?.open_total || 0);
  const total = Number(summary?.total || 0);
  const done = countOf(summary, "completed");
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full rounded-xl border bg-gradient-to-br p-4 text-left transition hover:shadow-md ${accent}`}
    >
      <div className="text-xs font-semibold opacity-80">{title}</div>
      <div className="mt-1 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-bold tracking-tight text-slate-900">
            {total.toLocaleString("th-TH")}
          </div>
          <div className="text-[12px] font-medium text-slate-600">รายการทั้งหมด</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums text-slate-800">
            ค้าง {open.toLocaleString("th-TH")}
          </div>
          <div className="text-[12px] font-medium text-emerald-700">ปิดแล้ว {pct}%</div>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/70">
        <div
          className="h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </button>
  );
}

function ClosurePanel({ summary }) {
  const open = Number(summary?.open_total || 0);
  const done = countOf(summary, "completed");
  const total = Number(summary?.total || 0);
  const pct = completedPct(summary);

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-xl border border-red-100 bg-gradient-to-br from-red-50 to-white p-4">
        <div className="text-xs font-semibold text-red-700">งานค้าง</div>
        <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {open.toLocaleString("th-TH")}
        </div>
        <div className="mt-2 text-[12px] font-medium text-slate-600">
          ยังไม่ปิดงาน · ต้องติดตามตาม step
        </div>
      </div>
      <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4">
        <div className="text-xs font-semibold text-emerald-700">ความคืบหน้าปิดเคส</div>
        <div className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          {pct.toFixed(0)}
          <span className="ml-1 text-base font-semibold text-slate-500">%</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3">
          <div className="rounded-lg bg-emerald-100/60 px-2.5 py-2">
            <div className="text-[10px] font-medium text-emerald-800">เสร็จสิ้น</div>
            <div className="text-sm font-bold tabular-nums text-slate-800">{done}</div>
          </div>
          <div className="rounded-lg bg-white/80 px-2.5 py-2">
            <div className="text-[10px] font-medium text-slate-500">ทั้งหมด</div>
            <div className="text-sm font-bold tabular-nums text-slate-800">{total}</div>
          </div>
        </div>
      </div>
      <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4">
        <div className="text-xs font-semibold text-amber-700">โฟลว์งาน</div>
        <div className="mt-2 space-y-1.5 text-[12px] font-medium text-slate-700">
          <div>1. CS กรอกเรื่อง</div>
          <div>2. QA รับเรื่อง + กรอก Excel</div>
          <div>3. หน่วยงานดำเนินการ</div>
          <div>4. QA Confirm ปิดงาน</div>
        </div>
      </div>
    </div>
  );
}

export function ServiceTransportDashboardPage() {
  const { message } = App.useApp();
  const { user } = useSession();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [period, setPeriod] = useState("month");
  const [summaries, setSummaries] = useState({
    all: null,
    internal: null,
    external: null,
  });

  const thaiDate = useMemo(() => formatTodayWithWeekday(), []);
  const summary = summaries[tab];
  const periodLabel = useMemo(() => {
    const option = PERIODS.find((item) => item.value === period);
    const rangeText =
      summary?.from && summary?.to
        ? formatDateRange(summary.from, summary.to)
        : "";
    return rangeText
      ? `${option?.label || period} · ${rangeText}`
      : option?.label || period;
  }, [period, summary?.from, summary?.to]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params = { period };
        const [all, internal, external] = await Promise.all([
          complaintApi.serviceTransportSummary(params),
          complaintApi.serviceTransportSummary({
            ...params,
            document_scope: SERVICE_SCOPE_INTERNAL,
          }),
          complaintApi.serviceTransportSummary({
            ...params,
            document_scope: SERVICE_SCOPE_EXTERNAL,
          }),
        ]);
        if (!cancelled) setSummaries({ all, internal, external });
      } catch (error) {
        if (!cancelled) {
          message.error(error.message || "โหลด Dashboard ไม่สำเร็จ");
          setSummaries({ all: null, internal: null, external: null });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [message, period]);

  const openList = (scope) => {
    if (scope === "internal") {
      navigate(serviceTransportListPath(SERVICE_SCOPE_INTERNAL));
      return;
    }
    if (scope === "external") {
      navigate(serviceTransportListPath(SERVICE_SCOPE_EXTERNAL));
      return;
    }
    navigate(serviceTransportListPath(SERVICE_SCOPE_INTERNAL));
  };

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
            <div className="text-xs text-red-200">Dashboard Complaint บริการ/ขนส่ง</div>
            <div className="truncate text-lg font-semibold">
              สวัสดี, {user?.display_name || user?.username}
            </div>
            <div className="text-xs text-slate-300">{thaiDate}</div>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-right text-white backdrop-blur">
            <div className="text-[11px] text-red-100">โฟลว์</div>
            <div className="text-sm font-semibold">CS → QA → หน่วยงาน → Confirm</div>
          </div>
        </div>
      </Card>

      <div className="sticky top-16 z-20 rounded-xl border border-slate-200 bg-white/95 p-2.5 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-slate-700">ตัวกรอง Dashboard</div>
            <div className="truncate text-[11px] font-medium text-slate-500">
              {periodLabel} · กรองจากวันที่ complaint · {PERIOD_HINT[period] || ""}
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <Radio.Group
              size="small"
              optionType="button"
              buttonStyle="solid"
              value={period}
              options={PERIODS}
              onChange={(event) => setPeriod(event.target.value)}
            />
            <Segmented
              size="middle"
              value={tab}
              options={SCOPE_TABS}
              onChange={setTab}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Spin size="large" />
        </div>
      ) : !summary ? (
        <Empty description="ยังไม่มีข้อมูล" className="py-16" />
      ) : (
        <>
          <section>
            <SectionTitle>1. ภาพรวม</SectionTitle>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={12} lg={8}>
                <KpiTile
                  icon={<ClockCircleOutlined />}
                  label="งานค้างทั้งหมด"
                  value={Number(summary.open_total || 0).toLocaleString("th-TH")}
                  hint="ยังไม่เสร็จสิ้น"
                  tone="red"
                  onClick={() => openList(tab)}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <KpiTile
                  icon={<InboxOutlined />}
                  label="ทั้งหมดในระบบ"
                  value={Number(summary.total || 0).toLocaleString("th-TH")}
                  hint={
                    tab === "all"
                      ? "ภายใน + ภายนอก"
                      : tab === "internal"
                        ? "ร้องเรียนภายใน"
                        : "ร้องเรียนภายนอก"
                  }
                  tone="slate"
                  onClick={() => openList(tab)}
                />
              </Col>
              <Col xs={24} sm={12} lg={8}>
                <KpiTile
                  icon={<CheckCircleOutlined />}
                  label="เสร็จสิ้น"
                  value={countOf(summary, "completed").toLocaleString("th-TH")}
                  hint={`${completedPct(summary).toFixed(0)}% ของทั้งหมด`}
                  tone="amber"
                  onClick={() => openList(tab)}
                />
              </Col>
            </Row>
          </section>

          {tab === "all" ? (
            <section>
              <SectionTitle>2. เปรียบเทียบภายใน / ภายนอก</SectionTitle>
              <div className="grid gap-3 md:grid-cols-2">
                <ScopeCompareCard
                  title="ร้องเรียนภายใน"
                  summary={summaries.internal}
                  accent="border-sky-100 from-sky-50 to-white"
                  onOpen={() => {
                    setTab("internal");
                    openList("internal");
                  }}
                />
                <ScopeCompareCard
                  title="ร้องเรียนภายนอก"
                  summary={summaries.external}
                  accent="border-rose-100 from-rose-50 to-white"
                  onOpen={() => {
                    setTab("external");
                    openList("external");
                  }}
                />
              </div>
            </section>
          ) : null}

          <section>
            <SectionTitle>{tab === "all" ? "3. ปิดเคส · โฟลว์" : "2. ปิดเคส · โฟลว์"}</SectionTitle>
            <Panel
              title="สถานะงาน"
              subtitle="สัดส่วนปิดเคสและขั้นตอนที่กำลังรอ"
            >
              <ClosurePanel summary={summary} />
            </Panel>
          </section>

          <section>
            <SectionTitle>
              {tab === "all" ? "4. Pipeline ตาม step" : "3. Pipeline ตาม step"}
            </SectionTitle>
            <Panel
              title="CS → QA → หน่วยงาน → QA Confirm"
              subtitle="กดการ์ดสถานะเพื่อไปหน้ารายการ"
              action={
                <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700">
                  <CarOutlined /> บริการ/ขนส่ง
                </span>
              }
            >
              <WorkflowPipeline
                summary={summary}
                onStatusClick={() => openList(tab)}
              />
            </Panel>
          </section>

          <section>
            <SectionTitle>
              {tab === "all" ? "5. จุดที่ต้องโฟกัส" : "4. จุดที่ต้องโฟกัส"}
            </SectionTitle>
            <Row gutter={[12, 12]}>
              <Col xs={24} md={8}>
                <KpiTile
                  icon={<FileSearchOutlined />}
                  label="รอ QA รับเรื่อง"
                  value={countOf(summary, "pending_qa").toLocaleString("th-TH")}
                  hint="CS ส่งมาแล้ว"
                  tone="orange"
                  onClick={() => openList(tab)}
                />
              </Col>
              <Col xs={24} md={8}>
                <KpiTile
                  icon={<TeamOutlined />}
                  label="รอหน่วยงานรับเรื่อง"
                  value={countOf(summary, "pending_department").toLocaleString("th-TH")}
                  hint="QA ส่งต่อแล้ว"
                  tone="rose"
                  onClick={() => openList(tab)}
                />
              </Col>
              <Col xs={24} md={8}>
                <KpiTile
                  icon={<CarOutlined />}
                  label="หน่วยงานกำลังดำเนินการ"
                  value={countOf(summary, "department_action").toLocaleString("th-TH")}
                  hint="ระหว่างแก้ไข"
                  tone="amber"
                  onClick={() => openList(tab)}
                />
              </Col>
            </Row>
          </section>
        </>
      )}
    </div>
  );
}
