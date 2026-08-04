import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { App, Button, Empty, Input, Space, Table, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { complaintApi } from "../services/api";
import { formatDate } from "../utils/datetime";

function formatDocumentAccepted(value) {
  const code = String(value || "").trim().toUpperCase();
  if (code === "P") return "รับเอกสาร";
  if (code === "O") return "ไม่รับเอกสาร";
  return null;
}

export function ComplaintsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 5, total: 0 });

  const load = useCallback(
    async (page = 1, pageSize = pagination.pageSize, keyword = q) => {
      setLoading(true);
      try {
        const result = await complaintApi.inbox({
          page,
          pageSize,
          q: keyword || undefined,
        });
        setRows(result.data || []);
        setPagination({
          page: result.pagination?.page || page,
          pageSize: result.pagination?.pageSize || pageSize,
          total: result.pagination?.total || 0,
        });
      } catch (error) {
        message.error(error.message || "โหลดรายการ Complaint ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [message, pagination.pageSize, q],
  );

  useEffect(() => {
    load(1, pagination.pageSize, "");
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRecord = (record) => {
    const pdr = encodeURIComponent(record.pdr_no || "");
    navigate(`/complaint-form?pdr=${pdr}&id=${record.id}`);
  };

  const columns = useMemo(
    () => [
      {
        title: "PDR",
        dataIndex: "pdr_no",
        width: 150,
        render: (value) => <span className="font-medium text-slate-800">{value || "-"}</span>,
      },
      {
        title: "ลูกค้า",
        dataIndex: "company_name",
        ellipsis: true,
        render: (value) => value || "-",
      },
      {
        title: "ปัญหา",
        dataIndex: "problem_name",
        ellipsis: true,
        render: (value) => value || "-",
      },
      {
        title: "ของเสีย / NG Q'ty",
        dataIndex: "ng_qty",
        width: 130,
        align: "right",
        render: (value) =>
          value == null || value === ""
            ? "-"
            : Number(value).toLocaleString("th-TH"),
      },
      {
        title: "วันที่รับเรื่อง",
        dataIndex: "received_date",
        width: 120,
        render: (value) => formatDate(value),
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
    // openRecord uses navigate which is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div>
      <PageHeader
        title="รายการ Complaint"
        description="งานค้างตามสิทธิ์ของคุณ — กดเปิดฟอร์มเพื่อทำต่อได้เลย"
      />

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <Space wrap className="w-full justify-between">
          <Input.Search
            allowClear
            placeholder="ค้นหา PDR / ลูกค้า / ปัญหา / หน่วยงาน"
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
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 720 }}
          locale={{
            emptyText: (
              <Empty description="ไม่มีงานค้างในกล่องของคุณตอนนี้" />
            ),
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
