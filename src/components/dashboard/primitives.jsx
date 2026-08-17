import { useEffect, useRef, useState } from "react";
import { Button, Card, Empty, Popover, Spin, Typography } from "antd";
import { ExportOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { money, qty } from "../../utils/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Shared look-and-feel for the Reject and Complaint dashboards. */

export const BAR_COLORS = [
  "#b91c1c",
  "#dc2626",
  "#ea580c",
  "#d97706",
  "#64748b",
  "#334155",
  "#7c2d12",
];

export const PIE_COLORS = ["#b91c1c", "#e11d48", "#ea580c", "#f59e0b", "#64748b"];

/** Mount children only when near the viewport — cuts first-paint API fan-out. */
export function LazyMount({
  children,
  rootMargin = "240px",
  minHeight = 160,
  fallback = null,
}) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, rootMargin]);

  return (
    <div ref={ref} style={visible ? undefined : { minHeight }}>
      {visible ? children : fallback ?? <div className="flex justify-center py-10"><Spin /></div>}
    </div>
  );
}

export function SectionTitle({ children, id }) {
  return (
    <div id={id} className="mb-3 scroll-mt-28">
      <Typography.Title level={5} className="!mb-0 !text-slate-800">
        {children}
      </Typography.Title>
    </div>
  );
}

function jumpToSection(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** Chip strip for the top filter band (only while near page top). */
export function SectionJumpNav({ items = [], className = "" }) {
  if (!items.length) return null;

  return (
    <div className={`min-w-0 ${className}`}>
      <div className="mb-1.5 text-[11px] font-semibold text-slate-500">ไปที่หัวข้อ</div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => jumpToSection(item.id)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Floating jump button — stays open until click outside (or toggle button again). */
export function SectionJumpFab({ items = [] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <Popover
      trigger="click"
      placement="topRight"
      open={open}
      onOpenChange={setOpen}
      arrow
      destroyOnHidden
      content={
        <div
          className="flex w-[220px] flex-col gap-1 py-0.5"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="mb-1 px-1 text-[11px] font-semibold text-slate-500">ไปที่หัวข้อ</div>
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => jumpToSection(item.id)}
              className="rounded-lg px-2.5 py-1.5 text-left text-[12px] font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {item.label}
            </button>
          ))}
        </div>
      }
    >
      <Button
        size="large"
        icon={<UnorderedListOutlined />}
        className="pointer-events-auto !h-12 !rounded-full !border-slate-200 !bg-white !px-4 !text-slate-800 !shadow-lg"
        title="ไปที่หัวข้อ"
      >
        หัวข้อ
      </Button>
    </Popover>
  );
}

export function Panel({ title, subtitle, action, children, className = "" }) {
  return (
    <Card
      className={`h-full rounded-xl shadow-sm ${className}`}
      styles={{
        body: {
          padding: 20,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        },
      }}
    >
      <div className="mb-4 flex min-h-[44px] shrink-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {subtitle ? (
            <div className="mt-1 text-[12px] leading-5 font-medium text-slate-600">{subtitle}</div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </Card>
  );
}

export function KpiTile({ icon, label, value, hint, tone = "red", onClick }) {
  const tones = {
    red: "bg-red-50 text-red-700",
    orange: "bg-orange-50 text-orange-700",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-50 text-rose-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3.5 text-left shadow-sm transition hover:border-red-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg ${tones[tone]}`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-slate-500">{label}</div>
        <div className="truncate text-xl font-bold tracking-tight text-slate-900">{value}</div>
        {hint ? <div className="truncate text-[11px] text-slate-400">{hint}</div> : null}
      </div>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-400 transition group-hover:bg-red-50 group-hover:text-red-600">
        <ExportOutlined className="text-sm" />
      </div>
    </button>
  );
}

export function wrapLabel(value, maxChars = 18) {
  const text = String(value || "");
  if (text.length <= maxChars) return text;
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 3).join("\n");
}

export function YAxisTick({ x, y, payload }) {
  const lines = String(wrapLabel(payload?.value, 16)).split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="end" fill="#334155" fontSize={11} fontWeight={500}>
        {lines.map((line, index) => (
          <tspan key={`${line}-${index}`} x={0} dy={index === 0 ? -(lines.length - 1) * 6 : 12}>
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function DetailList({
  items,
  colors = BAR_COLORS,
  renderMeta,
  onSelect,
  valueKey = "count",
  valueSuffix = "ครั้ง",
}) {
  const total = items.reduce((sum, item) => sum + Number(item[valueKey] || 0), 0) || 1;
  const clickable = typeof onSelect === "function";

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const value = Number(item[valueKey] || 0);
        const share = ((value / total) * 100).toFixed(1);
        const meta = renderMeta ? renderMeta(item) : null;
        const showNg = valueKey !== "ng_qty" && valueKey !== "claim_sheet_qty" && Number(item.ng_qty || 0) > 0;
        return (
          <div
            key={item.id || item.name}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelect(item) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(item);
                  }
                : undefined
            }
            className={`flex items-start justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 ${
              clickable ? "cursor-pointer transition hover:bg-red-50" : ""
            }`}
          >
            <div className="flex min-w-0 items-start gap-2">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ background: colors[index % colors.length] }}
              />
              <div className="min-w-0">
                <div className="text-[13px] leading-4 break-words text-slate-800">
                  <span className="font-semibold text-slate-500">{index + 1}.</span> {item.name}
                </div>
                {meta ? <div className="text-[12px] font-medium text-slate-700">{meta}</div> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold tabular-nums text-slate-900">
                {qty(value, 0)} {valueSuffix}
              </div>
              <div className="text-[12px] font-semibold text-slate-700">{share}%</div>
              {showNg ? (
                <div className="text-[12px] font-semibold tabular-nums text-red-700">
                  ของเสีย {qty(item.ng_qty, 0)} แผ่น
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function HorizontalRankChart({
  items,
  emptyText = "ไม่มีข้อมูลในช่วงนี้",
  colors = BAR_COLORS,
  renderMeta,
  onSelect,
  valueKey = "count",
  valueSuffix = "ครั้ง",
}) {
  if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  const values = items.map((item) => Number(item[valueKey] || item.count || 0));
  const total = values.reduce((sum, value) => sum + value, 0) || 1;
  const max = Math.max(...values, 1);
  const clickable = typeof onSelect === "function";

  return (
    <div className="flex h-full min-h-[360px] flex-col gap-2">
      {items.map((item, index) => {
        const value = Number(item[valueKey] || item.count || 0);
        const share = ((value / total) * 100).toFixed(1);
        const barPct = Math.max((value / max) * 100, 4);
        const sheets = Number(item.claim_sheet_qty || item.ng_qty || 0);
        const amount = item.reject_amount ?? item.claim_amount;
        const meta = renderMeta ? renderMeta(item) : null;
        const extras = [
          sheets > 0 && valueKey !== "claim_sheet_qty" && valueKey !== "ng_qty"
            ? `${qty(sheets, 0)} แผ่น`
            : null,
          amount != null && Number(amount) > 0 ? `${money(amount)} บาท` : null,
        ].filter(Boolean);

        return (
          <div
            key={item.id || item.name}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onSelect(item) : undefined}
            onKeyDown={
              clickable
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") onSelect(item);
                  }
                : undefined
            }
            className={`flex min-h-0 flex-1 flex-col justify-center rounded-xl border px-3 py-2.5 ${
              clickable
                ? "cursor-pointer border-slate-200 bg-slate-50 transition hover:border-red-200 hover:bg-red-50"
                : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[14px] leading-5 font-semibold break-words text-slate-900">
                  <span className="mr-1 font-bold text-slate-500">{index + 1}.</span>
                  {item.name}
                </div>
                {meta ? <div className="mt-0.5 text-[12px] font-medium text-slate-700">{meta}</div> : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-lg font-bold tabular-nums leading-none text-slate-900">
                  {qty(value, 0)}{" "}
                  <span className="text-[12px] font-semibold text-slate-700">{valueSuffix}</span>
                </div>
                <div className="mt-1 text-[12px] font-semibold text-slate-700">{share}%</div>
              </div>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full"
                style={{ width: `${barPct}%`, background: colors[index % colors.length] }}
              />
            </div>
            {extras.length ? (
              <div className="mt-1.5 text-[12px] font-semibold text-slate-700">
                {extras.join(" · ")}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function VerticalRankChart({
  items,
  emptyText = "ไม่มีข้อมูลในช่วงนี้",
  height = 300,
  compact = false,
  colors = BAR_COLORS,
  renderMeta,
  onSelect,
}) {
  if (!items?.length) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  const chartData = items.map((item) => ({
    ...item,
    label: `${Number(item.count || 0).toLocaleString("th-TH")} ครั้ง`,
  }));
  const clickable = typeof onSelect === "function";

  return (
    <div className={compact ? "" : "space-y-3"}>
      <div style={{ width: "100%", height }} className="min-h-[260px]">
        <ResponsiveContainer>
          <BarChart data={chartData} margin={{ top: 32, right: 16, left: 4, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={36} />
            <Tooltip
              formatter={(value, _name, props) => {
                const share = ((Number(value) / total) * 100).toFixed(1);
                const ng = Number(props?.payload?.ng_qty || 0);
                const ngText = ng > 0 ? ` · ของเสีย ${ng.toLocaleString("th-TH")} แผ่น` : "";
                return [`${value} ครั้ง (${share}%)${ngText}`, "จำนวน"];
              }}
            />
            <Bar
              dataKey="count"
              radius={[8, 8, 0, 0]}
              maxBarSize={64}
              cursor={clickable ? "pointer" : "default"}
              onClick={clickable ? (data) => onSelect(data?.payload || data) : undefined}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.id || entry.name} fill={colors[index % colors.length]} />
              ))}
              <LabelList
                dataKey="label"
                position="top"
                style={{ fill: "#0f172a", fontSize: 12, fontWeight: 700 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      {!compact ? (
        <DetailList items={items} colors={colors} renderMeta={renderMeta} onSelect={onSelect} />
      ) : null}
    </div>
  );
}
