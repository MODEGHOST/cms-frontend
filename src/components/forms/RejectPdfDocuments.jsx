import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Space,
  Tabs,
  Typography,
} from "antd";
import { DownloadOutlined, FilePdfOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { rejectApi } from "../../services/api";
import { formatProblemLabel } from "../../utils/problems";

function text(value, fallback = "—") {
  const raw = value == null ? "" : String(value).trim();
  return raw || fallback;
}

/** ส่งพร้อมงานซ่อม = ลูกค้าคืนงาน − จำนวนที่แจ้งส่ง */
function calcRepairWithQty(customerReturnQty, notifiedShipQty) {
  const returned =
    customerReturnQty == null || customerReturnQty === ""
      ? null
      : Number(customerReturnQty);
  const notified =
    notifiedShipQty == null || notifiedShipQty === ""
      ? null
      : Number(notifiedShipQty);
  if (!Number.isFinite(returned) || !Number.isFinite(notified)) return null;
  return Number((returned - notified).toFixed(4));
}

function syncMemoQtyFields(form, setDraft, patch = {}) {
  form.setFieldsValue(patch);
  setDraft((prev) => ({ ...prev, ...patch }));
}

/** รหัสลอนท้าย Size เมื่อไม่มี flute จาก ERP */
function fluteFromRecord(record) {
  const direct =
    record?.flute_name == null ? "" : String(record.flute_name).trim();
  if (direct) return direct;
  const size = String(record?.size || "").trim();
  const match = size.match(/\b(AB|BC|A|B|C|E)\s*$/i);
  return match ? match[1].toUpperCase() : "";
}

function formatQty(value) {
  if (value == null || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value, "");
  return number.toLocaleString("en-US");
}

function formatDateShort(value) {
  if (!value) return "";
  const d = dayjs.isDayjs(value) ? value : dayjs(value);
  if (!d.isValid()) return text(value, "");
  return d.format("DD/MM/YY");
}

function formatDateFull(value) {
  if (!value) return "";
  const d = dayjs.isDayjs(value) ? value : dayjs(value);
  if (!d.isValid()) return text(value, "");
  return d.format("DD/MM/YYYY");
}

function parseLines(value) {
  if (Array.isArray(value)) {
    return value.map((line) => String(line || "").trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.map((line) => String(line || "").trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
    return trimmed
      .split(/[\n,;]+/)
      .map((line) => line.trim())
      .filter(Boolean);
  }
  return [];
}

function qtyFromLine(line) {
  const match = String(line || "").match(/^\s*([\d,.]+)/);
  if (!match) return null;
  const n = Number(String(match[1]).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function buildDefaults(record) {
  const lines = parseLines(record?.pallet_lines);
  const palletCount = Number(record?.pallet_count) || lines.length || 1;
  while (lines.length < palletCount) lines.push("");
  // ลูกค้าคืนงาน — ดึงจากจำนวนเคลมในฟอร์ม Reject
  const customer_return_qty =
    record?.memo_customer_return_qty != null
      ? Number(record.memo_customer_return_qty)
      : record?.claim_sheet_qty != null
        ? Number(record.claim_sheet_qty)
        : null;
  // จำนวนที่แจ้งส่ง — กรอกเองใน Memo (ไม่ดึงอัตโนมัติ)
  const notified_ship_qty = null;
  return {
    lot_no: record?.memo_lot_no || record?.pdr_no || "",
    pallet_count: Math.max(1, palletCount),
    pallet_lines_text: lines.slice(0, Math.max(1, palletCount)).join("\n"),
    notified_ship_qty,
    customer_return_qty,
    tag_ship_date: record?.tag_ship_date
      ? dayjs(record.tag_ship_date)
      : record?.customer_ship_date
        ? dayjs(record.customer_ship_date)
        : dayjs(),
    big_sheet_qty: record?.big_sheet_qty ?? "",
    big_sheet_size: record?.big_sheet_size ?? "",
    small_sheet_size: record?.small_sheet_size ?? "",
  };
}

function YellowValue({ children, className = "" }) {
  return (
    <span className={`inline-block min-w-[3rem] bg-[#FFE600] px-1 font-medium ${className}`}>
      {children || "\u00A0"}
    </span>
  );
}

function Under({ children }) {
  return <span className="inline-block min-w-[4rem] border-b border-slate-800 px-0.5">{children}</span>;
}

function MemoPreview({ record, values }) {
  const lines = values.pallet_lines || [];
  return (
    <div className="overflow-x-auto bg-slate-100 p-3">
      <div className="mx-auto min-w-[560px] max-w-[720px] border-[1.5px] border-black bg-white px-5 py-4 text-[12px] text-black shadow-sm">
        <div className="mb-1 text-center text-[15px] font-bold tracking-wide underline underline-offset-4">
          LEE FIBREBOARD.LTD. MEMO RANDUM
        </div>
        <div className="mb-3 border-b border-black" />

        <div className="space-y-2.5">
          <div className="flex justify-between gap-4">
            <div>
              <span className="font-bold">ATTN :</span>{" "}
              <Under>วางแผน/การตลาด</Under>
            </div>
            <div>
              <span className="font-bold">DATE:</span>{" "}
              <Under>{formatDateFull(dayjs())}</Under>
            </div>
          </div>
          <div>
            <span className="font-bold">SUBJECT:</span> <Under>ส่งคืนงานREJECT</Under>
          </div>
          <div>
            <span className="font-bold">ลูกค้า:</span>{" "}
            <Under>
              {text(record?.company_name, text(record?.customer_alias_name, ""))}
            </Under>
          </div>
          <div>
            <span className="font-bold">ORDER:</span>{" "}
            <Under>{formatQty(record?.order_qty)}</Under>
          </div>
          <div>
            <span className="font-bold">เลขที่IV:</span>{" "}
            <Under>{text(record?.invoice_no, "")}</Under>
          </div>
          <div>
            <span className="font-bold">LOT NO:</span>{" "}
            <YellowValue className="border-b border-black">{values.lot_no}</YellowValue>
          </div>
          <div>
            <span className="font-bold">SOSA:</span>{" "}
            <Under>{text(record?.sale_order_no, "")}</Under>
          </div>
          <div>
            <span className="font-bold">SIZE:</span>{" "}
            <Under>{text(record?.size, "")}</Under>
          </div>
          <div>
            <span className="font-bold">ผลิต:</span>{" "}
            <Under>{formatDateFull(record?.production_date)}</Under>
            <span className="ml-6 font-bold">เครื่อง</span>{" "}
            <Under>{text(record?.machine_name, "")}</Under>
          </div>
          <div>
            <span className="font-bold">จำนวนที่แจ้งส่ง</span>{" "}
            <YellowValue className="min-w-[4rem] border-b border-black text-center">
              {formatQty(values.notified_ship_qty)}
            </YellowValue>{" "}
            แผ่น
          </div>

          <div className="flex flex-wrap items-start gap-x-8 gap-y-2">
            <div>
              <span className="font-bold">จำนวนพาเลท</span>{" "}
              <YellowValue className="min-w-[2rem] border-b border-black text-center">
                {values.pallet_count}
              </YellowValue>{" "}
              พาเลท
            </div>
            <div className="space-y-1">
              {lines.map((line, idx) => (
                <div key={`p-${idx}`}>
                  <YellowValue className="min-w-[5rem] border-b border-black text-center">
                    {line}
                  </YellowValue>{" "}
                  แผ่น
                </div>
              ))}
            </div>
          </div>

          <div className="py-1">
            <img
              src="/reject-memo-signature.png"
              alt="ลายเซ็น"
              className="h-[78px] w-auto object-contain"
            />
          </div>

          <div className="border-t border-black pt-3">
            <div className="mb-2">
              <span className="font-bold">ส่งพร้อมงานซ่อมจำนวน</span>{" "}
              <YellowValue className="min-w-[3.5rem] border-b border-black text-center text-red-600">
                {formatQty(values.repair_with_qty)}
              </YellowValue>{" "}
              แผ่น
            </div>
            <div>
              <span className="font-bold">ลูกค้าคืนงานจำนวน</span>{" "}
              <YellowValue className="min-w-[3.5rem] border-b border-black text-center">
                {formatQty(values.customer_return_qty)}
              </YellowValue>{" "}
              แผ่น
              <span className="ml-6 font-bold">ปัญหา</span>{" "}
              <Under>{formatProblemLabel(record)}</Under>
            </div>
          </div>

          <div className="pt-2">
            <div className="mb-2 font-bold">REMARKS:</div>
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="border-b border-dotted border-slate-500" />
              ))}
            </div>
            {text(record?.remark, "") ? (
              <div className="-mt-[4.5rem] text-[11px] leading-relaxed text-slate-800">
                {text(record?.remark, "")}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function TagCell({ children, className = "" }) {
  return (
    <div className={`border border-black px-1.5 py-1 ${className}`}>{children}</div>
  );
}

function TagCard({ record, values, palletIndex }) {
  const line = values.pallet_lines?.[palletIndex] || "";
  const deliverQty = qtyFromLine(line);
  const machine = text(record?.machine_name, "");
  const customer = text(
    record?.company_name,
    text(record?.customer_alias_name, ""),
  );
  const weight = formatQty(record?.weight_per_sheet);
  const weightNum = Number(record?.weight_per_sheet);
  const netWeight =
    deliverQty != null && Number.isFinite(weightNum)
      ? Number((deliverQty * weightNum).toFixed(4))
      : null;
  const plan = [
    formatDateShort(record?.production_date)?.replace(/\//g, "-"),
    record?.shift ? `PLAN ${record.shift}` : "",
    machine,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="border-2 border-black bg-white text-[10px] leading-tight text-black">
      <div className="grid grid-cols-[1fr_0.42fr]">
        <div className="min-w-0">
          <TagCell className="py-2 text-center text-[13px] font-bold">
            {`แผ่นส่ง ${machine}`.trim()}
          </TagCell>
          <div className="grid grid-cols-2">
            <TagCell className="text-center font-bold">น้ำหนักต่อแผ่น</TagCell>
            <TagCell className="text-center text-[12px] font-bold">
              {weight ? `${weight} กก.` : ""}
            </TagCell>
          </div>
        </div>
        <TagCell className="flex items-center justify-center text-[16px] font-bold">
          คลังสินค้า
        </TagCell>
      </div>

      <div className="grid grid-cols-[0.7fr_0.7fr_0.7fr_0.7fr_1.6fr]">
        <TagCell className="text-center font-bold">ลอน</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {fluteFromRecord(record)}
        </TagCell>
        <TagCell className="text-center font-bold">ผ่า</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {text(record?.cut_qty, "")}
        </TagCell>
        <TagCell className="flex items-center gap-2 font-bold">
          <span>พาเลทที่</span>
          <YellowValue className="min-w-[2rem] text-center">
            {palletIndex + 1}
          </YellowValue>
        </TagCell>
      </div>

      <div className="grid grid-cols-[0.7fr_2fr]">
        <TagCell className="text-center font-bold">รหัสสินค้า</TagCell>
        <TagCell className="font-bold">{text(record?.item_code, "")}</TagCell>
        <TagCell className="text-center font-bold">ชื่อสินค้า</TagCell>
        <TagCell className="font-bold">{text(record?.size, "")}</TagCell>
      </div>

      <div className="grid grid-cols-[0.7fr_1.2fr_0.8fr_1.2fr]">
        <TagCell className="text-center font-bold">PDR. NO</TagCell>
        <TagCell className="font-bold">{text(record?.pdr_no, "")}</TagCell>
        <TagCell className="text-center font-bold">Sale Order</TagCell>
        <TagCell className="font-bold">{text(record?.sale_order_no, "")}</TagCell>
      </div>

      <div className="grid grid-cols-[1.4fr_0.5fr_0.35fr_0.45fr_1fr]">
        <TagCell className="font-bold">จำนวนแผ่นใหญ่ที่ต้องการ</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {text(values.big_sheet_qty ?? record?.big_sheet_qty, "")}
        </TagCell>
        <TagCell className="text-center font-bold">แผ่น</TagCell>
        <TagCell className="text-center font-bold">ขนาด</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {text(values.big_sheet_size ?? record?.big_sheet_size, "")}
        </TagCell>
      </div>

      <div className="grid grid-cols-[1.4fr_0.5fr_0.35fr_0.45fr_1fr]">
        <TagCell className="font-bold">จำนวนแผ่นเล็กที่ต้องการ</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {formatQty(values.customer_return_qty)}
        </TagCell>
        <TagCell className="text-center font-bold">แผ่น</TagCell>
        <TagCell className="text-center font-bold">ขนาด</TagCell>
        <TagCell className="text-center text-[12px] font-bold">
          {text(values.small_sheet_size ?? record?.small_sheet_size, "")}
        </TagCell>
      </div>

      <div className="grid grid-cols-2">
        <TagCell className="text-center font-bold">ลำดับที่ / วันที่ผลิต</TagCell>
        <TagCell className="text-center font-bold">จำนวนส่งมอบ ( แผ่น )</TagCell>
      </div>

      <div className="grid grid-cols-2">
        <div className="min-w-0">
          <div className="grid grid-cols-[1.6fr_0.6fr]">
            <TagCell className="py-3 text-center text-[18px] font-bold">
              {formatQty(record?.order_qty)}
              {record?.order_qty != null && record?.order_qty !== "" ? " -" : ""}
            </TagCell>
            <TagCell className="py-3 text-center text-[18px] font-bold">
              {text(record?.shift, "")}
            </TagCell>
          </div>
          <TagCell className="bg-[#FFE600] font-bold">{plan}</TagCell>
        </div>
        <TagCell className="flex items-center justify-center text-[16px] font-bold">
          {deliverQty != null ? formatQty(deliverQty) : line}
        </TagCell>
      </div>

      <div className="grid grid-cols-[1.5fr_1fr]">
        <TagCell className="text-center font-bold">ชื่อลูกค้า</TagCell>
        <TagCell className="text-center font-bold">น้ำหนักสุทธิ  ( กก. )</TagCell>
        <TagCell className="py-2 font-bold">{customer}</TagCell>
        <TagCell className="flex items-center justify-center text-[12px] font-bold">
          {netWeight != null ? formatQty(netWeight) : ""}
        </TagCell>
      </div>

      <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr]">
        <TagCell className="row-span-2 flex min-h-[64px] flex-col justify-center gap-2 font-bold">
          <div>ผลการตรวจของ QC/QA</div>
          <div>ไลน์เครื่อง &nbsp; {machine}</div>
        </TagCell>
        <TagCell className="text-center font-bold">ขาดจำนวน</TagCell>
        <TagCell className="text-center font-bold">เกินจำนวน</TagCell>
        <TagCell className="min-h-[42px]" />
        <TagCell className="min-h-[42px]" />
      </div>

      <div className="grid grid-cols-[0.9fr_0.9fr_1.4fr]">
        <TagCell className="font-bold">วันที่ส่งของ</TagCell>
        <TagCell className="bg-[#FFE600] text-center font-bold">
          {formatDateShort(values.tag_ship_date)}
        </TagCell>
        <TagCell className="bg-[#A6A6A6] text-center text-[11px] font-bold">
          ส่งงาน Reject คืน
        </TagCell>
      </div>

      <div className="grid grid-cols-[0.55fr_2fr]">
        <TagCell className="font-bold">หมายเหตุ</TagCell>
        <TagCell className="min-h-[28px]">{text(record?.remark, "")}</TagCell>
      </div>
    </div>
  );
}

function TagPreview({ record, values }) {
  const count = Math.max(1, Number(values.pallet_count) || 1);
  const pages = [];
  for (let i = 0; i < count; i += 2) {
    pages.push([i, i + 1 < count ? i + 1 : null]);
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-slate-500">
        A4 แนวนอน · หน้าละ 2 Tag · รวม {count} พาเลท / {pages.length} หน้า
      </div>
      {pages.map((pair, pageIdx) => (
        <div
          key={`page-${pageIdx}`}
          className="overflow-x-auto rounded border border-slate-400 bg-slate-100 p-3 shadow-sm"
        >
          <div className="mb-2 text-[10px] font-semibold text-slate-500">
            หน้า {pageIdx + 1}
          </div>
          <div className="grid min-w-[640px] grid-cols-2 gap-3">
            <TagCard record={record} values={values} palletIndex={pair[0]} />
            {pair[1] != null ? (
              <TagCard record={record} values={values} palletIndex={pair[1]} />
            ) : (
              <div className="rounded border border-dashed border-slate-300 bg-white/60" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PalletLinesEditor({ form, draft, setDraft }) {
  return (
    <div className="space-y-2">
      {Array.from({
        length: Math.max(1, Number(draft.pallet_count) || 1),
      }).map((_, idx) => {
        const lines = parseLines(draft.pallet_lines_text);
        return (
          <div key={`pallet-line-${idx}`}>
            <div className="mb-1 text-xs font-medium text-slate-600">
              พาเลทที่ {idx + 1}
            </div>
            <Input
              placeholder="จำนวนแผ่น เช่น 100 หรือ 800*1"
              value={lines[idx] || ""}
              onChange={(e) => {
                const count = Math.max(
                  1,
                  Number(form.getFieldValue("pallet_count")) || 1,
                );
                const next = parseLines(
                  form.getFieldValue("pallet_lines_text"),
                );
                while (next.length < count) next.push("");
                next[idx] = e.target.value;
                const pallet_lines_text = next.slice(0, count).join("\n");
                form.setFieldsValue({ pallet_lines_text });
                setDraft({
                  ...form.getFieldsValue(true),
                  pallet_lines_text,
                });
              }}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Inline editable overrides + live Memo/Tag preview + PDF download.
 * Edits are download-only (not saved to DB).
 * Left form fields switch with Memo / Tag tab.
 */
export function RejectPdfDocuments({ record }) {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(null);
  const [activeDoc, setActiveDoc] = useState("memo");
  const [form] = Form.useForm();
  const [draft, setDraft] = useState(() => buildDefaults(record));

  const canDownload = Boolean(record?.id);
  const isMemo = activeDoc === "memo";

  useEffect(() => {
    const next = buildDefaults(record);
    form.setFieldsValue(next);
    setDraft(next);
  }, [
    record?.id,
    record?.cut_qty,
    record?.item_code,
    record?.big_sheet_qty,
    record?.big_sheet_size,
    record?.small_sheet_size,
    form,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewValues = useMemo(() => {
    const palletCount = Math.max(1, Number(draft.pallet_count) || 1);
    const lines = parseLines(draft.pallet_lines_text);
    while (lines.length < palletCount) lines.push("");
    return {
      lot_no: String(draft.lot_no || "").trim(),
      pallet_count: palletCount,
      pallet_lines: lines.slice(0, palletCount),
      notified_ship_qty: draft.notified_ship_qty,
      repair_with_qty: calcRepairWithQty(
        draft.customer_return_qty,
        draft.notified_ship_qty,
      ),
      customer_return_qty: draft.customer_return_qty,
      tag_ship_date: draft.tag_ship_date,
      big_sheet_qty: draft.big_sheet_qty,
      big_sheet_size: draft.big_sheet_size,
      small_sheet_size: draft.small_sheet_size,
    };
  }, [draft]);

  const syncPalletLines = (nextValues = {}) => {
    const merged = { ...form.getFieldsValue(true), ...nextValues };
    const count = Number(merged.pallet_count) || 1;
    const lines = parseLines(merged.pallet_lines_text);
    while (lines.length < count) lines.push("");
    const pallet_lines_text = lines.slice(0, count).join("\n");
    form.setFieldsValue({ pallet_lines_text });
    setDraft({ ...merged, pallet_lines_text });
  };

  const buildPayload = async (type) => {
    const fields =
      type === "tag"
        ? ["pallet_count", "customer_return_qty", "tag_ship_date"]
        : [
            "lot_no",
            "pallet_count",
            "notified_ship_qty",
            "customer_return_qty",
          ];
    const values = await form.validateFields(fields);
    const all = { ...form.getFieldsValue(true), ...values };
    const palletCount = Math.max(1, Number(all.pallet_count) || 1);
    const lines = parseLines(all.pallet_lines_text);
    while (lines.length < palletCount) lines.push("");
    const sliced = lines.slice(0, palletCount);
    if (sliced.some((line) => !String(line || "").trim())) {
      throw new Error("กรุณากรอกจำนวนแผ่นให้ครบทุกพาเลท");
    }
    return {
      lot_no: String(all.lot_no || "").trim(),
      pallet_count: palletCount,
      pallet_lines: sliced,
      notified_ship_qty: all.notified_ship_qty,
      repair_with_qty: calcRepairWithQty(
        all.customer_return_qty,
        all.notified_ship_qty,
      ),
      customer_return_qty: all.customer_return_qty,
      tag_ship_date: all.tag_ship_date
        ? dayjs.isDayjs(all.tag_ship_date)
          ? all.tag_ship_date.format("YYYY-MM-DD")
          : dayjs(all.tag_ship_date).format("YYYY-MM-DD")
        : null,
    };
  };

  const handleDownload = async (type) => {
    try {
      setActiveDoc(type);
      const payload = await buildPayload(type);
      setDownloading(type);
      if (type === "tag") {
        await rejectApi.downloadTagPdf(record.id, payload);
        message.success(
          `ดาวน์โหลด Tag PDF แล้ว (${payload.pallet_count} พาเลท / ${Math.ceil(payload.pallet_count / 2)} หน้า)`,
        );
      } else {
        await rejectApi.downloadMemoPdf(record.id, payload);
        message.success("ดาวน์โหลด Memo PDF แล้ว");
      }
    } catch (error) {
      if (error?.errorFields) return;
      message.error(error.message || "ดาวน์โหลด PDF ไม่สำเร็จ");
    } finally {
      setDownloading(null);
    }
  };

  if (!canDownload) return null;

  return (
    <Card
      size="small"
      title={
        <Space>
          <FilePdfOutlined className="text-red-600" />
          <Typography.Text>เอกสาร Memo / Tag</Typography.Text>
        </Space>
      }
      extra={
        <Space wrap>
          <Button
            type={isMemo ? "primary" : "default"}
            icon={<DownloadOutlined />}
            loading={downloading === "memo"}
            disabled={Boolean(downloading)}
            onClick={() => handleDownload("memo")}
          >
            ดาวน์โหลด Memo PDF
          </Button>
          <Button
            type={!isMemo ? "primary" : "default"}
            icon={<DownloadOutlined />}
            loading={downloading === "tag"}
            disabled={Boolean(downloading)}
            onClick={() => handleDownload("tag")}
          >
            ดาวน์โหลด Tag PDF
          </Button>
        </Space>
      }
    >
      <Alert
        className="!mb-3"
        type="info"
        showIcon
        message="สลับแท็บ Memo / Tag เพื่อแก้ค่าเฉพาะเอกสารนั้น · ไม่บันทึกลงระบบ · Preview อัปเดตตามค่าที่กรอก"
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] xl:items-start">
        <div className="rounded border border-amber-200 bg-amber-50/60 p-3 xl:sticky xl:top-3">
          <Typography.Text strong className="!mb-1 !block">
            {isMemo ? "ค่าที่ใช้ใน Memo" : "ค่าที่ใช้ใน Tag"}
          </Typography.Text>
          <Typography.Paragraph type="secondary" className="!mb-3 !text-xs">
            ไม่บันทึก · ค่าที่กรอกไว้ยังอยู่เมื่อสลับแท็บ
          </Typography.Paragraph>
          <Form
            form={form}
            layout="vertical"
            className="!mb-0"
            onValuesChange={(_, all) =>
              setDraft((prev) => ({ ...prev, ...all }))
            }
            size="small"
            preserve
          >
            {isMemo ? (
              <Form.Item
                name="lot_no"
                label="LOT NO"
                rules={[{ required: true, message: "กรุณากรอก LOT NO" }]}
              >
                <Input placeholder="เช่น PDR2608-03094" />
              </Form.Item>
            ) : (
              <Form.Item
                name="tag_ship_date"
                label="วันที่ส่งของ"
                rules={[{ required: true, message: "กรุณาเลือกวันที่ส่งของ" }]}
              >
                <DatePicker className="!w-full" format="DD/MM/YYYY" />
              </Form.Item>
            )}

            {/* พาเลท + จำนวนแผ่น อยู่ติดกัน */}
            <div className="mb-3 rounded border border-amber-300/80 bg-white/70 p-2.5">
              <Form.Item
                name="pallet_count"
                label={isMemo ? "จำนวนพาเลท" : "จำนวนพาเลท (= จำนวน Tag)"}
                className="!mb-2"
                rules={[{ required: true, message: "กรุณากรอกจำนวนพาเลท" }]}
              >
                <InputNumber
                  min={1}
                  max={50}
                  className="!w-full"
                  onChange={(value) => {
                    setTimeout(
                      () => syncPalletLines({ pallet_count: value }),
                      0,
                    );
                  }}
                />
              </Form.Item>

              <Form.Item name="pallet_lines_text" hidden>
                <Input.TextArea />
              </Form.Item>

              <div className="mb-1 text-xs font-semibold text-slate-700">
                จำนวนแผ่นต่อพาเลท
              </div>
              <PalletLinesEditor
                form={form}
                draft={draft}
                setDraft={setDraft}
              />
            </div>

            {isMemo ? (
              <>
                <Form.Item
                  name="notified_ship_qty"
                  label="จำนวนที่แจ้งส่ง (แผ่น)"
                  rules={[
                    { required: true, message: "กรุณากรอกจำนวนที่แจ้งส่ง" },
                  ]}
                  extra={
                    <span className="text-[11px] text-slate-500">
                      กรอกเอง — ไม่ดึงอัตโนมัติ
                    </span>
                  }
                >
                  <InputNumber
                    min={0}
                    className="!w-full"
                    onChange={(value) =>
                      syncMemoQtyFields(form, setDraft, {
                        notified_ship_qty: value,
                      })
                    }
                  />
                </Form.Item>

                <Form.Item
                  name="customer_return_qty"
                  label="ลูกค้าคืนงานจำนวน (แผ่น)"
                  rules={[
                    { required: true, message: "กรุณากรอกจำนวนคืนงาน" },
                  ]}
                  extra={
                    <span className="text-[11px] text-slate-500">
                      ดึงจากจำนวนเคลมในฟอร์ม Reject
                    </span>
                  }
                >
                  <InputNumber
                    min={0}
                    className="!w-full"
                    onChange={(value) =>
                      syncMemoQtyFields(form, setDraft, {
                        customer_return_qty: value,
                      })
                    }
                  />
                </Form.Item>
              </>
            ) : (
              <Form.Item
                name="customer_return_qty"
                label="จำนวนแผ่นเล็กที่ต้องการ"
                rules={[
                  { required: true, message: "กรุณากรอกจำนวนแผ่นเล็ก" },
                ]}
              >
                <InputNumber min={0} className="!w-full" />
              </Form.Item>
            )}
          </Form>
        </div>

        <div className="min-w-0">
          <Tabs
            activeKey={activeDoc}
            onChange={setActiveDoc}
            items={[
              {
                key: "memo",
                label: "Preview Memo (A4 แนวตั้ง)",
                children: (
                  <MemoPreview record={record} values={previewValues} />
                ),
              },
              {
                key: "tag",
                label: `Preview Tag (A4 แนวนอน · ${previewValues.pallet_count} ใบ)`,
                children: <TagPreview record={record} values={previewValues} />,
              },
            ]}
          />
        </div>
      </div>
    </Card>
  );
}
