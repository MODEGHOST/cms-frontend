import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightOutlined } from "@ant-design/icons";
import { App, Button, Empty, Input, Segmented, Space, Table, Tag } from "antd";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { rejectApi } from "../services/api";
import { formatDate } from "../utils/datetime";

const SOURCE_FILTERS = [
  { label: "จาก Complaint", value: "complaint" },
  { label: "ทั้งหมด", value: "all" },
];

function sourceLabel(value) {
  if (value === "complaint") return "จาก Complaint";
  if (value === "api") return "จาก API";
  if (value === "import") return "Import";
  return value || "Excel/อื่นๆ";
}

export function RejectsPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("complaint");
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10, total: 0 });

  const load = useCallback(
    async (page = 1, pageSize = pagination.pageSize, keyword = q, sourceFilter = source) => {
      setLoading(true);
      try {
        const result = await rejectApi.list({
          page,
          pageSize,
          q: keyword || undefined,
          source: sourceFilter === "all" ? undefined : sourceFilter,
        });
        setRows(result.data || []);
        setPagination({
          page: result.pagination?.page || page,
          pageSize: result.pagination?.pageSize || pageSize,
          total: result.pagination?.total || 0,
        });
      } catch (error) {
        message.error(error.message || "โหลดรายการ Reject ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [message, pagination.pageSize, q, source],
  );

  useEffect(() => {
    load(1, pagination.pageSize, "", "complaint");
    // initial load only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openRecord = (record) => {
    const pdr = encodeURIComponent(record.pdr_no || "");
    navigate(`/reject-form?pdr=${pdr}&id=${record.id}`);
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
        title: "เครื่อง",
        dataIndex: "machine_name",
        width: 110,
        render: (value) => value || "-",
      },
      {
        title: "แหล่งที่มา",
        dataIndex: "source",
        width: 140,
        render: (value) => (
          <Tag color={value === "complaint" ? "red" : "default"}>{sourceLabel(value)}</Tag>
        ),
      },
      {
        title: "วันที่สร้าง",
        dataIndex: "created_at",
        width: 120,
        render: (value) => formatDate(value),
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
        title="รายการ Reject"
        description="รายการที่ CS ส่งมาจาก Complaint และรายการ Reject อื่นๆ — QC เปิดฟอร์มเพื่อกรอกต่อ"
      />

      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <Space wrap className="w-full justify-between">
          <Space wrap>
            <Segmented
              options={SOURCE_FILTERS}
              value={source}
              onChange={(value) => {
                setSource(value);
                load(1, pagination.pageSize, q, value);
              }}
            />
            <Input.Search
              allowClear
              placeholder="ค้นหา PDR / ลูกค้า / ปัญหา"
              style={{ width: 320, maxWidth: "100%" }}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              onSearch={(value) => load(1, pagination.pageSize, value, source)}
            />
          </Space>
          <div className="text-sm text-slate-500">
            {pagination.total.toLocaleString("th-TH")} รายการ
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
          scroll={{ x: 860 }}
          locale={{
            emptyText: (
              <Empty
                description={
                  source === "complaint"
                    ? "ยังไม่มีรายการจาก Complaint — เมื่อ CS กดซ่อมจะโผล่ที่นี่"
                    : "ยังไม่มีรายการ Reject"
                }
              />
            ),
          }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            pageSizeOptions: ["10", "20", "50"],
            showTotal: (total) => `ทั้งหมด ${total.toLocaleString("th-TH")} รายการ`,
            onChange: (page, pageSize) => load(page, pageSize, q, source),
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
