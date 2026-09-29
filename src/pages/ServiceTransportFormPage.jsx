import { useEffect, useMemo, useState } from "react";
import { CarOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, App, Button, Spin } from "antd";
import { useSearchParams } from "react-router-dom";
import { ComplaintForm } from "../components/forms/ComplaintForm";
import { PageHeader } from "../components/ui/PageHeader";
import { complaintApi } from "../services/api";
import { canCsWork } from "../utils/authz";
import { useSession } from "../hooks/useSession";
import {
  normalizeServiceScope,
  serviceScopeLabel,
  SERVICE_SCOPE_EXTERNAL,
  SERVICE_SCOPE_INTERNAL,
} from "../constants/serviceTransport";
import { cacheInvalidate } from "../utils/dashboardCache";

function emptyDraft(scope) {
  return {
    complaint_kind: "service_transport",
    document_scope: scope,
    workflow_status: "cs_draft",
    company_name: "",
    sale_cs_staff: "",
    grade: "",
    license_plate: "",
    subject: "",
    received_date: null,
    document_accepted: null,
    attachments: [],
  };
}

export function ServiceTransportFormPage() {
  const { message } = App.useApp();
  const { user } = useSession();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState(null);

  const scopeFromUrl = normalizeServiceScope(searchParams.get("scope"));
  const scope = normalizeServiceScope(record?.document_scope) || scopeFromUrl;
  const scopeTitle = serviceScopeLabel(scope);

  const loadById = async (id) => {
    setLoading(true);
    try {
      const result = await complaintApi.getById(id);
      const row = result?.data;
      if (!row) {
        message.warning("ไม่พบรายการ");
        setRecord(null);
        return;
      }
      if (row.complaint_kind && row.complaint_kind !== "service_transport") {
        message.warning("รายการนี้ไม่ใช่ Complaint บริการ/ขนส่ง");
        setRecord(null);
        return;
      }
      const rowScope = normalizeServiceScope(row.document_scope);
      if (scopeFromUrl && rowScope && rowScope !== scopeFromUrl) {
        message.warning(
          `รายการนี้อยู่ใน${serviceScopeLabel(rowScope)} — เปิดจากเมนูที่ถูกต้อง`,
        );
      }
      setRecord(row);
      if (rowScope) {
        setSearchParams(
          { id: String(row.id), scope: rowScope },
          { replace: true },
        );
      }
    } catch (error) {
      message.error(error.message || "โหลดรายการไม่สำเร็จ");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) {
      loadById(id);
      return;
    }
    setRecord(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.get("id")]);

  const startNew = (nextScope = scope) => {
    const normalized = normalizeServiceScope(nextScope);
    if (!normalized) {
      message.warning("กรุณาเลือก ร้องเรียนภายใน หรือ ร้องเรียนภายนอก");
      return;
    }
    setSearchParams({ scope: normalized });
    setRecord(emptyDraft(normalized));
  };

  const onSaved = (updated) => {
    cacheInvalidate("complaint");
    setRecord(updated);
    if (updated?.id) {
      const nextScope =
        normalizeServiceScope(updated.document_scope) || scope || SERVICE_SCOPE_INTERNAL;
      setSearchParams({ id: String(updated.id), scope: nextScope });
    }
  };

  const chooser = useMemo(
    () => (
      <div className="mx-auto mb-5 grid max-w-3xl gap-3 sm:grid-cols-2">
        <Button
          type="primary"
          size="large"
          className="!h-auto !whitespace-normal !py-4"
          icon={<PlusOutlined />}
          onClick={() => startNew(SERVICE_SCOPE_INTERNAL)}
        >
          สร้างร้องเรียนภายใน
        </Button>
        <Button
          size="large"
          className="!h-auto !whitespace-normal !py-4"
          icon={<PlusOutlined />}
          onClick={() => startNew(SERVICE_SCOPE_EXTERNAL)}
        >
          สร้างร้องเรียนภายนอก
        </Button>
      </div>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user],
  );

  return (
    <div>
      <PageHeader
        title={scope ? `ฟอร์ม ${scopeTitle}` : "ฟอร์ม Complaint บริการ/ขนส่ง"}
        description="CS เลือกลูกค้าจาก Master (ดึง Sale/CS จาก customer_care) แล้วกรอกทะเบียนรถ / เรื่อง / วันที่ / Action plan ส่ง QA ตาม step เดิม — แยกชีตตาม Excel ร้องเรียนภายใน / ภายนอก"
        extra={
          canCsWork(user) && scope ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => startNew(scope)}>
              สร้างรายการใหม่
            </Button>
          ) : null
        }
      />

      {!record && !loading ? (
        <div className="mx-auto mb-5 max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl text-red-700">
                <CarOutlined />
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  {scope
                    ? `เริ่มกรอก ${scopeTitle}`
                    : "เริ่มกรอก Complaint บริการ/ขนส่ง"}
                </div>
                <div className="text-sm text-slate-500">
                  ไม่ต้องค้นหา PDR — เลือกประเภทตามชีต Excel แล้วกรอกข้อมูล CS ได้เลย
                </div>
              </div>
            </div>
            {canCsWork(user) ? (
              scope ? (
                <Button type="primary" icon={<PlusOutlined />} onClick={() => startNew(scope)}>
                  สร้างรายการใหม่
                </Button>
              ) : null
            ) : (
              <Alert
                type="info"
                showIcon
                message="เปิดรายการจากเมนูรายการ ร้องเรียนภายใน/ภายนอก เพื่อทำต่อตามสิทธิ์ของคุณ"
              />
            )}
          </div>
          {canCsWork(user) && !scope ? <div className="mt-4">{chooser}</div> : null}
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Spin size="large" />
        </div>
      ) : null}

      {record ? (
        <ComplaintForm
          record={record}
          kind="service_transport"
          onSaved={onSaved}
        />
      ) : null}
    </div>
  );
}
