import { CheckCircleOutlined, MinusOutlined, WarningOutlined } from "@ant-design/icons";
import { formatDate } from "../../utils/datetime";
import { money, qty } from "../../utils/format";

const STATUS = {
  improved: {
    label: "เสียหายน้อยลง",
    sentence: "ความเสียหายลดลงเมื่อเทียบกับช่วงก่อนหน้า",
    className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    pill: "bg-emerald-600 text-white",
  },
  flat: {
    label: "ทรงตัว",
    sentence: "ความเสียหายใกล้เคียงช่วงก่อนหน้า",
    className: "border-slate-200 bg-slate-50 text-slate-800",
    pill: "bg-slate-600 text-white",
  },
  worse: {
    label: "เสียหายเพิ่มขึ้น",
    sentence: "ความเสียหายเพิ่มขึ้นเมื่อเทียบกับช่วงก่อนหน้า",
    className: "border-red-200 bg-red-50 text-red-900",
    pill: "bg-red-700 text-white",
  },
};

function rangeText(from, to) {
  if (!from && !to) return "";
  const start = formatDate(from);
  const end = formatDate(to);
  return start === end ? start : `${start} – ${end}`;
}

function deltaText(current, previous, unit) {
  if (previous == null) return null;
  const diff = Number(current || 0) - Number(previous || 0);
  if (diff === 0) return `เท่าช่วงก่อน (${qty(previous, 0)} ${unit})`;
  const sign = diff > 0 ? "+" : "";
  return `${sign}${qty(diff, 0)} ${unit} จากช่วงก่อน`;
}

export function CompanyPulse({ headline }) {
  if (!headline) return null;
  const status = STATUS[headline.status] || null;
  const isComplaint = headline.kind === "complaint";
  const Icon =
    headline.status === "improved"
      ? CheckCircleOutlined
      : headline.status === "worse"
        ? WarningOutlined
        : MinusOutlined;
  const problems = (headline.focus_problems || []).filter(Boolean);
  const action =
    headline.focus_department && headline.focus_problem
      ? `ให้ ${headline.focus_department} เร่งแก้ ${headline.focus_problem}`
      : headline.focus_problem
        ? `เร่งแก้ ${headline.focus_problem}`
        : headline.focus_department
          ? `ให้ ${headline.focus_department} เร่งตรวจสอบ`
          : null;

  return (
    <div
      className={`rounded-xl border px-4 py-3.5 shadow-sm ${
        status?.className || "border-slate-200 bg-white text-slate-800"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-bold leading-snug">
            {headline.period_label || "ช่วงที่เลือก"}
            {headline.from ? (
              <span className="ml-2 text-sm font-semibold text-slate-700">
                {rangeText(headline.from, headline.to)}
              </span>
            ) : null}
          </div>
          <div className="mt-1 text-[13px] font-medium">
            {status ? status.sentence : "ภาพรวมตามช่วงที่เลือกจากตัวกรองด้านบน"}
          </div>
        </div>
        {status ? (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-bold ${status.pill}`}
          >
            <Icon />
            {status.label}
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <div className="text-[12px] font-semibold text-slate-700">
            {isComplaint ? "โดนร้องเรียน" : "โดน Reject"}
          </div>
          <div className="text-xl font-bold tabular-nums leading-tight">
            {qty(headline.count, 0)} ครั้ง
          </div>
          <div className="text-[12px] font-semibold text-slate-700">
            {deltaText(headline.count, headline.previous_count, "ครั้ง") || "—"}
          </div>
        </div>
        <div>
          <div className="text-[12px] font-semibold text-slate-700">ความเสียหาย</div>
          {isComplaint ? (
            <>
              <div className="text-xl font-bold tabular-nums leading-tight">
                {qty(headline.ng_qty, 0)} แผ่นของเสีย
              </div>
              <div className="text-[12px] font-semibold text-slate-700">
                {deltaText(headline.ng_qty, headline.previous_ng_qty, "แผ่น") || "—"}
              </div>
            </>
          ) : (
            <>
              <div className="text-xl font-bold tabular-nums leading-tight">
                {qty(headline.claim_sheet_qty, 0)} แผ่น
              </div>
              <div className="text-[12px] font-semibold text-slate-700">
                {deltaText(
                  headline.claim_sheet_qty,
                  headline.previous_claim_sheet_qty,
                  "แผ่น",
                ) || "—"}
                {headline.reject_amount ? ` · ${money(headline.reject_amount)} บาท` : ""}
              </div>
            </>
          )}
        </div>
        <div>
          <div className="text-[12px] font-semibold text-slate-700">ปัญหาที่ต้องแก้</div>
          <div className="text-sm font-bold leading-snug">
            {problems.length ? problems.join(" · ") : "—"}
          </div>
          {action ? (
            <div className="mt-0.5 text-[13px] font-semibold text-slate-800">{action}</div>
          ) : null}
        </div>
      </div>

      {headline.previous_from && headline.previous_to ? (
        <div className="mt-2 text-[12px] font-medium text-slate-700">
          เทียบกับช่วงเท่ากันก่อนหน้า {rangeText(headline.previous_from, headline.previous_to)}
        </div>
      ) : null}
    </div>
  );
}
