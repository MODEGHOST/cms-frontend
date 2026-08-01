import { Card, Empty, Typography } from "antd";
import { ExportOutlined } from "@ant-design/icons";
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

export function SectionTitle({ children }) {
  return (
    <div className="mb-3">
      <Typography.Title level={5} className="!mb-0 !text-slate-800">
        {children}
      </Typography.Title>
    </div>
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
            <div className="mt-0.5 text-[11px] leading-4 text-slate-400">{subtitle}</div>
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

export function DetailList({ items, colors = BAR_COLORS, renderMeta, onSelect }) {
  const total = items.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
  const clickable = typeof onSelect === "function";

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const share = ((Number(item.count || 0) / total) * 100).toFixed(1);
        const meta = renderMeta ? renderMeta(item) : null;
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
                {meta ? <div className="text-[11px] text-slate-400">{meta}</div> : null}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold text-slate-900">
                {Number(item.count || 0).toLocaleString("th-TH")} ครั้ง
              </div>
              <div className="text-[11px] text-slate-400">{share}%</div>
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
  height = 300,
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
    <div className="flex h-full flex-col">
      <div className="shrink-0" style={{ height }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 72, left: 8, bottom: 4 }}
            barCategoryGap="16%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={150} interval={0} tick={<YAxisTick />} />
            <Tooltip
              formatter={(value, _name, props) => {
                const share = ((Number(value) / total) * 100).toFixed(1);
                return [`${value} ครั้ง (${share}%)`, props?.payload?.name || "จำนวน"];
              }}
            />
            <Bar
              dataKey="count"
              radius={[0, 8, 8, 0]}
              maxBarSize={36}
              cursor={clickable ? "pointer" : "default"}
              onClick={clickable ? (data) => onSelect(data?.payload || data) : undefined}
            >
              {chartData.map((entry, index) => (
                <Cell key={entry.id || entry.name} fill={colors[index % colors.length]} />
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
      <div className="mt-4 min-h-0 flex-1 overflow-auto">
        <DetailList items={items} colors={colors} renderMeta={renderMeta} onSelect={onSelect} />
      </div>
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
              formatter={(value) => {
                const share = ((Number(value) / total) * 100).toFixed(1);
                return [`${value} ครั้ง (${share}%)`, "จำนวน"];
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
