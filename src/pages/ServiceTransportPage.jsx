import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { App, Button, Empty, Input, Space, Table, Tag } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { complaintApi } from "../services/api";
import { formatDate } from "../utils/datetime";
import { COMPLAINT_WORKFLOW_LABELS } from "../constants/complaintWorkflow";
import {
  normalizeServiceScope,
  serviceScopeLabel,
  serviceTransportFormPath,
  SERVICE_SCOPE_EXTERNAL,
  SERVICE_SCOPE_INTERNAL,
} from "../constants/serviceTransport";

function formatDocumentAccepted(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code === "P") return "รับเอกสาร";
  if (code === "O") return "ไม่รับเอกสาร";
  return null;
}

export function ServiceTransportPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const scope = normalizeServiceScope(searchParams.get("scope"));
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 5, total: 0 });

  useEffect(() => {
    if (scope) return;
    setSearchParams({ scope: SERVICE_SCOPE_INTERNAL }, { replace: true });
  }, [scope, setSearchParams]);

  const load = useCallback(
    async (page = 1, pageSize = pagination.pageSize, keyword = q) => {
      if (!scope) return;
      setLoading(true);
      try {
        const result = await complaintApi.inbox({
          page,
          pageSize,
          q: keyword || undefined,
          kind: "service_transport",
          document_scope: scope,
        });
        setRows(result.data || []);
        setPagination({
          page: result.pagination?.page || page,
          pageSize: result.pagination?.pageSize || pageSize,
          total: result.pagination?.total || 0,
        });
      } catch (error) {
        message.error(error.message || "โหลดรายการไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [message, pagination.pageSize, q, scope],
  );

  useEffect(() => {
    if (!scope) return;
    load(1, pagination.pageSize, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const openRecord = (record) => {
    navigate(
      serviceTransportFormPath({
        scope: record.document_scope || scope,
        id: record.id,
      }),
    );
  };

  const columns = useMemo(
    () => [
      {
        title: "ชื่อลูกค้า",
        dataIndex: "company_name",
        width: 180,
        ellipsis: true,
        render: (value) => (
          <span className="font-medium text-slate-800">{value || "-"}</span>
        ),
      },
      {
        title: "Sale/CS",
        dataIndex: "sale_cs_staff",
        width: 140,
        ellipsis: true,
        render: (value) => value || "-",
      },
      {
        title: "ทะเบียนรถ",
        dataIndex: "license_plate",
        width: 130,
        render: (value) => (
          <span className="font-medium text-slate-800">{value || "-"}</span>
        ),
      },
      {
        title: "เรื่องที่ complaint",
        dataIndex: "subject",
        ellipsis: true,
        render: (value) => value || "-",
      },
      {
        title: "วันที่ complaint",
        dataIndex: "received_date",
        width: 130,
        render: (value) => formatDate(value),
      },
      {
        title: "สถานะ",
        dataIndex: "workflow_status",
        width: 160,
        render: (value) => COMPLAINT_WORKFLOW_LABELS[value] || value || "-",
      },
      {
        title: "เอกสาร Action plan",
        dataIndex: "document_accepted",
        width: 140,
        render: (value) => {
          const label = formatDocumentAccepted(value);
          if (!label) return "-";
          return (
            <Tag color={String(value).toUpperCase() === "P" ? "green" : "default"}>
              {label}
            </Tag>
          );
        },
      },
      {
        title: "",
        key: "action",
        width: 110,
        fixed: "right",
        render: (_, record) => (
          <Button
            type="link"
            className="!px-0"
            icon={<ArrowRightOutlined />}
            onClick={(event) => {
              event.stopPropagation();
              openRecord(record);
            }}
          >
            เปิดฟอร์ม
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope],
  );

  const scopeTitle = serviceScopeLabel(scope);

  return (
    <div>
      <PageHeader
        title={`รายการ ${scopeTitle}`}
        description="งานค้างตามสิทธิ์ของคุณ — กดเปิดฟอร์มเพื่อทำต่อได้เลย (แยกตามชีต Excel ร้องเรียนภายใน / ภายนอก)"
        extra={
          <Space wrap>
            <Button
              type={scope === SERVICE_SCOPE_INTERNAL ? "primary" : "default"}
              onClick={() => setSearchParams({ scope: SERVICE_SCOPE_INTERNAL })}
            >
              ร้องเรียนภายใน
            </Button>
            <Button
              type={scope === SERVICE_SCOPE_EXTERNAL ? "primary" : "default"}
              onClick={() => setSearchParams({ scope: SERVICE_SCOPE_EXTERNAL })}
            >
              ร้องเรียนภายนอก
            </Button>
          </Space>
        }
      />

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <Space wrap className="w-full justify-between">
          <Input.Search
            allowClear
            placeholder="ค้นหา ทะเบียนรถ / เรื่อง / วันที่"
            style={{ width: 360, maxWidth: "100%" }}
            value={q}
            onChange={(event) => setQ(event.target.value)}
            onSearch={(value) => load(1, pagination.pageSize, value)}
          />
          <div className="text-sm text-slate-500">
            รอดำเนินการ {pagination.total.toLocaleString("th-TH")} รายการ
          </div>
        </Space>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm md:p-5">
        <Table
          rowKey="id"
          size="middle"
          loading={loading || !scope}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 720 }}
          locale={{
            emptyText: <Empty description="ไม่มีงานค้างในกล่องของคุณตอนนี้" />,
          }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ["5", "10", "20"],
            showTotal: (total) => `ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`,
            onChange: (page, pageSize) => load(page, pageSize, q),
          }}
          onRow={(record) => ({
            onClick: () => openRecord(record),
            className: "cursor-pointer",
          })}
        />
      </div>
    </div>
  );
}
