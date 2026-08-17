import { useMemo, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Image,
  Space,
  Typography,
} from "antd";
import { DownloadOutlined, FilePdfOutlined } from "@ant-design/icons";
import { complaintApi } from "../../services/api";
import { formatDate } from "../../utils/datetime";
import { formatProblemLabel, formatProblemNameEn } from "../../utils/problems";

function text(value, fallback = "-") {
  const raw = value == null ? "" : String(value).trim();
  return raw || fallback;
}

function formatQty(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return text(value, "");
  return number.toLocaleString("en-US");
}

function ngPercent(ngQty, demandQty) {
  const ng = Number(ngQty);
  const demand = Number(demandQty);
  if (!Number.isFinite(ng) || !Number.isFinite(demand) || demand <= 0) return "-";
  return `${((ng / demand) * 100).toFixed(2)}%`;
}

function parsePlan(raw) {
  if (!raw) return { contributors: [], approvals: {}, pdfImageSlots: {} };
  let parsed = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { contributors: [], approvals: {}, pdfImageSlots: {} };
    }
  }
  return {
    contributors: Array.isArray(parsed?.contributors) ? parsed.contributors : [],
    approvals: parsed?.approvals || {},
    pdfImageSlots: parsed?.pdfImageSlots || parsed?.pdf_image_slots || {},
  };
}

function groupImagesBySlot(imageFiles, pdfImageSlots = {}) {
  const hasMapping = Object.keys(pdfImageSlots || {}).length > 0;
  const grouped = { picture: [], cause: [], correction: [], prevention: [] };
  for (const file of imageFiles || []) {
    const mapped = pdfImageSlots[String(file.id)] || pdfImageSlots[file.id];
    if (hasMapping) {
      if (mapped && grouped[mapped]) grouped[mapped].push(file);
    } else {
      grouped.picture.push(file);
    }
  }
  for (const key of Object.keys(grouped)) {
    grouped[key] = grouped[key].slice(0, 3);
  }
  return grouped;
}

function SlotImages({ files, sizeClass = "!h-16 !w-24" }) {
  if (!files?.length) return null;
  return (
    <div className="flex shrink-0 flex-col flex-wrap gap-1.5">
      {files.map((file) => (
        <Image
          key={file.id}
          src={`${file.url}?inline=1`}
          alt={file.original_name}
          className={`${sizeClass} object-contain`}
          rootClassName={`[&_.ant-image-img]:h-16 [&_.ant-image-img]:w-24 [&_.ant-image-img]:object-contain`}
        />
      ))}
    </div>
  );
}

function attachmentById(attachments, id) {
  if (!id) return null;
  return (attachments || []).find((item) => Number(item.id) === Number(id)) || null;
}

function CheckMark({ checked }) {
  return (
    <span
      className={`inline-flex h-3.5 w-3.5 items-center justify-center border border-slate-800 text-[9px] leading-none ${
        checked ? "bg-[#FFE600] text-black" : "bg-white"
      }`}
    >
      {checked ? "✓" : ""}
    </span>
  );
}

/**
 * On-screen Corrective Action Plan preview (matches Excel CAP layout).
 * Shown only when document_accepted = P and workflow is completed.
 */
export function ActionPlanDocument({ record }) {
  const { message } = App.useApp();
  const [downloading, setDownloading] = useState(false);

  const plan = useMemo(() => parsePlan(record?.plan_form_json), [record?.plan_form_json]);
  const planSigIds = useMemo(() => {
    const ids = new Set();
    for (const row of plan.contributors) {
      if (row?.signatureId) ids.add(Number(row.signatureId));
    }
    for (const role of Object.values(plan.approvals || {})) {
      if (role?.signatureId) ids.add(Number(role.signatureId));
    }
    return ids;
  }, [plan]);

  const imageFiles = useMemo(
    () =>
      (record?.attachments || []).filter(
        (item) =>
          String(item.kind || "file") !== "signature" &&
          !planSigIds.has(Number(item.id)) &&
          String(item.mime_type || "").startsWith("image/"),
      ),
    [record?.attachments, planSigIds],
  );
  const imagesBySlot = useMemo(
    () => groupImagesBySlot(imageFiles, plan.pdfImageSlots),
    [imageFiles, plan.pdfImageSlots],
  );

  // Excel: ติ๊กแถวภายใน/ภายนอกอย่างเดียว ไม่โชว์ตัว P
  // ถ้าไม่ได้เลือกภายนอก ให้ถือเป็นภายใน (กรอก จาก=แจ้งปัญหา, ถึง=รับผิดชอบ)
  const scope = String(record?.document_scope || "").trim();
  const external = scope === "ภายนอก";
  const internal = !external;
  const ownerName =
    plan.contributors.find((row) => String(row?.name || "").trim())?.name ||
    text(record?.responsible_department_name, "");
  const actionDate = formatDate(record?.completed_date || record?.confirmed_at);
  const madeDate = formatDate(record?.confirmed_at || record?.completed_date);

  const contributorRows = plan.contributors
    .filter(
      (row) =>
        String(row?.name || "").trim() ||
        String(row?.position || "").trim() ||
        row?.signatureId,
    )
    .slice(0, 6);

  const downloadPdf = async () => {
    try {
      setDownloading(true);
      await complaintApi.downloadActionPlanPdf(record.id);
      message.success("ดาวน์โหลดเอกสาร Action Plan แล้ว");
    } catch (error) {
      message.error(error.message || "ดาวน์โหลด PDF ไม่สำเร็จ");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card
      id="action-plan-document"
      size="small"
      title={
        <Space>
          <FilePdfOutlined className="text-red-600" />
          <Typography.Text>เอกสาร Action Plan (Corrective Action Plan)</Typography.Text>
        </Space>
      }
      extra={
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          loading={downloading}
          onClick={downloadPdf}
        >
          ดาวน์โหลด PDF
        </Button>
      }
    >
      <Alert
        className="!mb-3"
        type="success"
        showIcon
        message="เอกสารพร้อมส่งลูกค้า — PDF 1 หน้า (รูปแบบเดียวกับที่ Export จาก Excel) กดดาวน์โหลดได้เลย"
      />

      <div className="min-w-0 overflow-x-auto rounded border border-slate-400 bg-white p-3 text-[11px] text-slate-800 shadow-sm">
        <div className="mx-auto min-w-[640px] max-w-[794px]">
          {/* Header 3 ช่องเหมือน Excel */}
          <div className="grid grid-cols-[150px_1fr_150px] border border-slate-700">
            <div className="flex items-center gap-2 border-r border-slate-700 px-2 py-2">
              <img
                src="/lee-fibreboard-logo.png"
                alt="LEE FIBREBOARD"
                className="h-8 w-8 object-contain"
              />
              <div>
                <div className="text-[10px] font-bold leading-tight">LEE FIBREBOARD</div>
                <div className="text-[9px] leading-tight text-slate-600">
                  บริษัท ลีไฟเบอร์บอร์ด จำกัด
                </div>
              </div>
            </div>
            <div className="border-r border-slate-700 bg-[#D9D9D9] px-2 py-2 text-center">
              <div className="text-sm font-bold">แผนการปฏิบัติการ</div>
              <div className="text-xs font-semibold tracking-wide">CORRECTIVE ACTION PLAN</div>
            </div>
            <div className="divide-y divide-slate-700 bg-[#D9D9D9] text-[11px]">
              <div className="px-2 py-1.5">วันที่จัดทำ : {madeDate}</div>
              <div className="px-2 py-1.5">
                เลขที่ : <span className="font-semibold">{text(record?.document_no, "")}</span>
              </div>
            </div>
          </div>

          {/* Dept routing */}
          <div className="border-x border-b border-slate-700 p-2">
            <div className="grid grid-cols-[auto_auto_1fr] items-start gap-x-2 gap-y-1.5">
              <span className="row-span-2 self-start pt-0.5 whitespace-nowrap">
                หน่วยงานที่แจ้งปัญหา :
              </span>

              <div className="flex items-center gap-2">
                <CheckMark checked={internal} />
                <span className="whitespace-nowrap">หน่วยงานภายใน จาก (แผนก)</span>
              </div>
              <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1 py-0.5"
                  title={internal ? text(record?.reported_by_department_name, "") : "-"}
                >
                  {internal ? text(record?.reported_by_department_name, "") : "-"}
                </span>
                <span className="shrink-0 whitespace-nowrap">ถึง (แผนก)</span>
                <span
                  className="min-w-[120px] max-w-[160px] truncate whitespace-nowrap border-b border-slate-700 px-1 py-0.5"
                  title={internal ? text(record?.responsible_department_name, "") : "-"}
                >
                  {internal ? text(record?.responsible_department_name, "") : "-"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <CheckMark checked={external} />
                <span className="whitespace-nowrap">หน่วยงานภายนอก (ลูกค้า)</span>
              </div>
              <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <span
                  className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1 py-0.5"
                  title={external ? text(record?.company_name, "") : "-"}
                >
                  {external ? text(record?.company_name, "") : "-"}
                </span>
                <span className="shrink-0 whitespace-nowrap">ถึง (แผนก)</span>
                <span
                  className="min-w-[120px] max-w-[160px] truncate whitespace-nowrap border-b border-slate-700 px-1 py-0.5"
                  title={external ? text(record?.responsible_department_name, "") : "-"}
                >
                  {external ? text(record?.responsible_department_name, "") : "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <table className="w-full border-collapse border border-slate-700">
            <tbody>
              <tr>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="shrink-0 text-slate-600">ชื่อลูกค้า /Customer name :</span>{" "}
                    <span
                      className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1"
                      title={text(record?.company_name, "")}
                    >
                      {text(record?.company_name, "")}
                    </span>
                  </div>
                </td>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <div className="flex min-w-0 flex-wrap items-baseline gap-1">
                    <span className="shrink-0 text-slate-600">ปัญหา / Problem</span>{" "}
                    <span
                      className="truncate whitespace-nowrap border-b border-slate-700 px-1"
                      title={formatProblemLabel(record)}
                    >
                      {formatProblemLabel(record)}
                    </span>
                    {formatProblemNameEn(record) ? (
                      <span
                        className="ml-1 truncate font-medium text-red-700"
                        title={formatProblemNameEn(record)}
                      >
                        {formatProblemNameEn(record)}
                      </span>
                    ) : null}
                  </div>
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="shrink-0 text-slate-600">รายละเอียด / Description</span>{" "}
                    <span
                      className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1"
                      title={text(record?.product_name, "")}
                    >
                      {text(record?.product_name, "")}
                    </span>
                  </div>
                </td>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <span className="text-slate-600">จำนวนต้องการ / Q&apos;ty</span>{" "}
                  <span className="border-b border-slate-700 px-1">
                    {formatQty(record?.demand_qty)}
                  </span>{" "}
                  แผ่นเล็ก / pcs.
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <span className="font-bold">JOB</span>{" "}
                  <span className="ml-1 inline-block bg-[#FFE600] px-2 py-0.5 font-semibold">
                    {text(record?.pdr_no, "")}
                  </span>
                </td>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <span className="text-slate-600">จำนวนของเสีย / NG Q&apos;ty</span>{" "}
                  <span className="border-b border-slate-700 px-1">
                    {formatQty(record?.ng_qty)}
                  </span>{" "}
                  แผ่นเล็ก / pcs.
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <span className="text-slate-600">Order / MC /MFD.</span>{" "}
                  <span className="mx-1 border-b border-slate-700 px-1">
                    {text(record?.order_no, "")}
                  </span>
                  <span className="mx-1 border-b border-slate-700 px-1">
                    {text(record?.machine_name, "")}
                  </span>
                  <span className="mx-1 border-b border-slate-700 px-1">
                    {text(record?.shift, "")}
                  </span>
                </td>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <span className="text-slate-600">คิดเป็นเปอร์เซนต์ / %</span>{" "}
                  <span className="border-b border-slate-700 px-1 font-bold text-red-700">
                    {ngPercent(record?.ng_qty, record?.demand_qty)}
                  </span>
                </td>
              </tr>
              <tr>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="shrink-0 text-slate-600">ทีม Sale/Cs :</span>
                    <span
                      className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1"
                      title={text(record?.sale_cs_staff, "")}
                    >
                      {text(record?.sale_cs_staff, "")}
                    </span>
                  </div>
                </td>
                <td className="border border-slate-500 px-2 py-1.5" colSpan={2}>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="shrink-0 text-slate-600">หมายเหตุ /Remark :</span>
                    <span
                      className="min-w-0 flex-1 truncate whitespace-nowrap border-b border-slate-700 px-1"
                      title={
                        text(record?.remark, "") === "-" ? "" : text(record?.remark, "")
                      }
                    >
                      {text(record?.remark, "") === "-" ? "" : text(record?.remark, "")}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Action sections */}
          <table className="w-full border-collapse border border-slate-700">
            <thead>
              <tr className="bg-[#D9D9D9]">
                <th className="w-[12%] border border-slate-600 px-2 py-1.5 text-center font-semibold">
                  ลำดับที่
                </th>
                <th className="border border-slate-600 px-2 py-1.5 text-center font-semibold">
                  สิ่งที่จะดำเนินการจัดทำ / แก้ไข / ป้องกัน
                </th>
                <th className="w-[12%] border border-slate-600 px-2 py-1.5 text-center font-semibold">
                  วันที่ดำเนินการ
                </th>
                <th className="w-[12%] border border-slate-600 px-2 py-1.5 text-center font-semibold">
                  ผู้รับผิดชอบ
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-600 px-2 py-2 text-center align-middle">
                  <div className="font-semibold">Picture</div>
                  <div className="text-slate-500">( รูปภาพ )</div>
                </td>
                <td className="border border-slate-600 px-2 py-2">
                  {imagesBySlot.picture.length ? (
                    <div className="flex flex-wrap gap-2">
                      {imagesBySlot.picture.map((file) => (
                        <Image
                          key={file.id}
                          src={`${file.url}?inline=1`}
                          alt={file.original_name}
                          className="!h-20 !w-28 object-contain"
                          rootClassName="[&_.ant-image-img]:h-20 [&_.ant-image-img]:w-28 [&_.ant-image-img]:object-contain"
                        />
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-300">&nbsp;</span>
                  )}
                </td>
                <td className="border border-slate-600" />
                <td className="border border-slate-600" />
              </tr>
              {[
                {
                  title: "Root cause",
                  sub: "(สาเหตุ)",
                  body: record?.cause,
                  slot: "cause",
                },
                {
                  title: "Corrective Action",
                  sub: "(การแก้ไขเบื้องต้น)",
                  body: record?.correction,
                  slot: "correction",
                },
                {
                  title: "Preventive Action",
                  sub: "(การป้องกันไม่ให้เกิดซ้ำ)",
                  body: record?.prevention,
                  slot: "prevention",
                },
              ].map((section) => (
                <tr key={section.title}>
                  <td className="border border-slate-400 px-2 py-2 text-center align-top">
                    <div className="font-semibold">{section.title}</div>
                    <div className="text-slate-500">{section.sub}</div>
                  </td>
                  <td className="border border-slate-400 px-2 py-2 align-top">
                    <div className="flex items-start gap-2">
                      {section.slot ? (
                        <SlotImages files={imagesBySlot[section.slot]} />
                      ) : null}
                      <div className="min-w-0 flex-1 whitespace-pre-wrap">
                        {text(section.body, "")}
                      </div>
                    </div>
                  </td>
                  <td className="border border-slate-400 px-2 py-2 text-center align-middle">
                    {actionDate}
                  </td>
                  <td className="border border-slate-400 px-2 py-2 text-center align-middle">
                    {ownerName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Footer: ผู้ร่วมจัดทำแผน | ลายเซ็นผู้อนุมัติ | บันทึกการติดตาม — ตาม Excel */}
          <div className="grid grid-cols-[1.15fr_0.55fr_0.95fr] gap-0 border border-slate-500">
            {/* Left: contributors */}
            <div className="border-r border-slate-500">
              <div className="border-b border-slate-400 bg-slate-50 px-2 py-1.5 text-center font-semibold">
                ผู้ร่วมจัดทำแผน
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border-b border-r border-slate-400 px-2 py-1 text-left font-medium">
                      ชื่อ - สกุล
                    </th>
                    <th className="border-b border-r border-slate-400 px-2 py-1 text-left font-medium">
                      ตำแหน่ง
                    </th>
                    <th className="w-24 border-b border-slate-400 px-2 py-1 text-center font-medium">
                      ลงชื่อ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: Math.max(contributorRows.length, 4) }, (_, index) => {
                    const row = contributorRows[index] || {
                      name: "",
                      position: "",
                      signatureId: null,
                    };
                    const sig = attachmentById(record?.attachments, row.signatureId);
                    return (
                      <tr key={`cap-row-${index}`}>
                        <td className="h-14 border-b border-r border-slate-400 px-2 py-1 align-middle">
                          {text(row.name, "\u00a0")}
                        </td>
                        <td className="border-b border-r border-slate-400 px-2 py-1 align-middle">
                          {text(row.position, "\u00a0")}
                        </td>
                        <td className="border-b border-slate-400 px-1 py-1">
                          <div className="mx-auto flex h-14 w-28 items-center justify-center">
                            {sig ? (
                              <Image
                                src={`${sig.url}?inline=1`}
                                alt="ลายเซ็น"
                                className="!h-full !w-full object-contain"
                                rootClassName="h-full w-full [&_.ant-image-img]:h-full [&_.ant-image-img]:w-full [&_.ant-image-img]:object-contain"
                              />
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Middle: approval signatures — ไม่มีหัวคอลัมน์ / ไม่มีเส้นแบ่ง */}
            <div className="flex flex-col border-r border-slate-500">
              {[
                { key: "production_specialist", label: "ผู้เชี่ยวชาญการผลิต" },
                { key: "qa_deputy", label: "รองผู้จัดการฝ่ายประกันคุณภาพ" },
              ].map((role) => {
                const approval = plan.approvals?.[role.key];
                const sig = attachmentById(record?.attachments, approval?.signatureId);
                const heading = String(approval?.position || "").trim() || role.label;
                return (
                  <div
                    key={role.key}
                    className="flex flex-1 flex-col items-center justify-end px-2 py-3"
                  >
                    <div className="mb-1.5 flex h-[88px] w-full max-w-[160px] items-center justify-center">
                      {sig ? (
                        <Image
                          src={`${sig.url}?inline=1`}
                          alt={heading}
                          className="!h-full !w-full object-contain"
                          rootClassName="h-full w-full [&_.ant-image-img]:h-full [&_.ant-image-img]:w-full [&_.ant-image-img]:object-contain"
                        />
                      ) : (
                        <div className="h-16 w-full" />
                      )}
                    </div>
                    <div className="w-full border-t border-dotted border-slate-500 pt-1 text-center text-[10px] leading-snug text-slate-600">
                      {heading}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Right: follow-up log (บันทึกการติดตาม) */}
            <div className="flex flex-col">
              <div className="border-b border-slate-400 bg-slate-50 px-2 py-1.5 text-center font-semibold">
                บันทึกการติดตามผลการแก้ไขปัญหา
              </div>
              <div className="flex flex-1 flex-col px-3 pb-2 pt-5">
                <div className="mb-5 flex-1 space-y-7">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div key={`follow-line-${index}`} className="border-b border-dotted border-slate-400" />
                  ))}
                </div>
                <div className="mt-auto space-y-2 text-[10px] text-slate-700">
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">ผู้ตรวจสอบ</span>
                    <span className="min-w-0 flex-1 border-b border-dotted border-slate-500" />
                    <span className="shrink-0">วันที่</span>
                    <span className="w-16 border-b border-dotted border-slate-500" />
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="shrink-0">ผู้ทบทวน</span>
                    <span className="min-w-0 flex-1 border-b border-dotted border-slate-500" />
                    <span className="shrink-0">วันที่</span>
                    <span className="w-16 border-b border-dotted border-slate-500" />
                  </div>
                  <div className="pt-1 text-center text-[10px] text-slate-600">
                    หัวหน้าแผนก QA
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-1 text-right text-[9px] text-slate-500">
            LFB-QAD-FM-011/REV.NO.03
          </div>
        </div>
      </div>
    </Card>
  );
}

export function canShowActionPlanDocument(record) {
  return (
    String(record?.document_accepted || "").toUpperCase() === "P" &&
    String(record?.workflow_status || "") === "completed"
  );
}
