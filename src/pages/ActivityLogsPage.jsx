import { useCallback, useEffect, useState } from "react";
import { App, Input, Select, Space, Table, Tag, Typography } from "antd";
import { PageHeader } from "../components/ui/PageHeader";
import { activityLogApi } from "../services/api";
import { formatDate } from "../utils/datetime";

const ACTION_LABELS = {
  fill: { color: "green", text: "กรอกฟอร์ม" },
  update: { color: "blue", text: "อัปเดตแก้ไข" },
};

function formatDateTime(value) {
  if (!value) return "-";
  return formatDate(value, "DD/MM/YYYY HH:mm");
}

export function ActivityLogsPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0 });
  const [q, setQ] = useState("");
  const [action, setAction] = useState();

  const load = useCallback(
    async (page = 1, pageSize = pagination.pageSize) => {
      setLoading(true);
      try {
        const result = await activityLogApi.list({
          page,
          pageSize,
          q: q || undefined,
          action: action || undefined,
        });
        setRows(result.data || []);
        setPagination({
          page: result.pagination?.page || page,
          pageSize: result.pagination?.pageSize || pageSize,
          total: result.pagination?.total || 0,
        });
      } catch (error) {
        message.error(error.message || "โหลด Log ไม่สำเร็จ");
      } finally {
        setLoading(false);
      }
    },
    [action, message, pagination.pageSize, q],
  );

  useEffect(() => {
    load(1, pagination.pageSize);
    // intentionally reload when filters change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action]);

  const columns = [
    {
      title: "เวลา",
      dataIndex: "created_at",
      width: 150,
      render: (value) => formatDateTime(value),
    },
    {
      title: "ผู้ใช้",
      dataIndex: "display_name",
      width: 160,
      render: (_, row) => (
        <div>
          <div className="font-medium">{row.display_name || row.username || "-"}</div>
          <div className="text-xs text-slate-400">
            {row.department ? `แผนก ${row.department}` : row.username || "-"}
          </div>
        </div>
      ),
    },
    {
      title: "การกระทำ",
      dataIndex: "action",
      width: 130,
      render: (value) => {
        const meta = ACTION_LABELS[value] || { color: "default", text: value };
        return <Tag color={meta.color}>{meta.text}</Tag>;
      },
    },
    {
      title: "รายละเอียด",
      dataIndex: "summary",
      render: (value, row) => (
        <div>
          <div>{value}</div>
          {Array.isArray(row.changes) && row.changes.length ? (
            <Typography.Paragraph
              className="!mb-0 !mt-1 text-xs text-slate-500"
              ellipsis={{ rows: 2, expandable: true, symbol: "ดูเพิ่ม" }}
            >
              {row.changes
                .map((item) => `${item.label}: ${item.before} → ${item.after}`)
                .join(" · ")}
            </Typography.Paragraph>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Activity Log"
        description="ดูว่าใครกรอกฟอร์มหรืออัปเดตแก้ไข Reject ช่องไหนบ้าง"
      />
      <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm">
        <Space wrap>
          <Input.Search
            allowClear
            placeholder="ค้นหาชื่อ / สรุป / แผนก"
            style={{ width: 280 }}
            onSearch={() => load(1)}
            onChange={(e) => setQ(e.target.value)}
            value={q}
          />
          <Select
            allowClear
            placeholder="ประเภทการกระทำ"
            style={{ width: 180 }}
            value={action}
            onChange={setAction}
            options={[
              { value: "fill", label: "กรอกฟอร์ม" },
              { value: "update", label: "อัปเดตแก้ไข" },
            ]}
          />
        </Space>
      </div>
      <div className="rounded-2xl bg-white p-2 shadow-sm md:p-4">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          scroll={{ x: 800 }}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            onChange: (page, pageSize) => load(page, pageSize),
          }}
        />
      </div>
    </div>
  );
}
