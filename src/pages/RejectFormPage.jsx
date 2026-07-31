import { useState } from "react";
import { FileSearchOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Input, Spin, Table, Typography } from "antd";
import { RejectForm } from "../components/forms/RejectForm";
import { PageHeader } from "../components/ui/PageHeader";
import { rejectApi } from "../services/api";
import { formatDate } from "../utils/datetime";

const RESULT_COLUMNS = [
  { title: "PDR", dataIndex: "pdr_no" },
  { title: "Invoice", dataIndex: "invoice_no", render: (value) => value || "-" },
  { title: "ลูกค้า", dataIndex: "company_name", render: (value) => value || "-" },
  { title: "Size", dataIndex: "size", render: (value) => value || "-" },
  {
    title: "วันที่ผลิต",
    dataIndex: "production_date",
    render: (value) => formatDate(value),
  },
];

export function RejectFormPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);

  const searchByPdr = async (rawValue) => {
    const pdrNo = String(rawValue || "").trim();
    if (!pdrNo) {
      message.warning("กรุณากรอกเลข PDR");
      return;
    }

    setLoading(true);
    setSearched(true);
    setRecords([]);
    setSelectedRecord(null);

    try {
      const result = await rejectApi.searchByPdr(pdrNo);
      const rows = result.data || [];
      setRecords(rows);
      if (rows.length === 1) setSelectedRecord(rows[0]);
    } catch (error) {
      message.error(error.message || "ไม่สามารถค้นหาข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="ฟอร์ม Reject"
        description="ค้นหาด้วยเลข PDR แล้วตรวจ/แก้ไขช่อง QC — ระบบจะบันทึก Activity Log ทุกครั้งที่บันทึก"
      />

      <div className="mx-auto mb-5 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl text-red-700">
              <FileSearchOutlined />
            </div>
            <div className="min-w-0">
              <Typography.Title level={5} className="!mb-0">
                ค้นหาข้อมูลด้วยเลข PDR
              </Typography.Title>
              <Typography.Text type="secondary" className="text-sm">
                กรอกเลข PDR แล้วกดค้นหาเพื่อแสดงข้อมูล Reject
              </Typography.Text>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-[430px]">
            <Input.Search
              size="large"
              allowClear
              enterButton="ค้นหา"
              placeholder="เช่น PDR2607-01267"
              onSearch={searchByPdr}
              loading={loading}
              aria-label="เลข PDR"
            />
          </div>
        </div>
      </div>

      <Spin spinning={loading}>
        {!loading && searched && records.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <Empty description="ไม่พบข้อมูล Reject สำหรับเลข PDR นี้" />
          </div>
        ) : null}

        {records.length > 1 ? (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={`พบ ${records.length} รายการสำหรับ PDR นี้ กรุณาเลือกรายการที่ต้องการดู`}
            />
            <Table
              rowKey="id"
              size="small"
              scroll={{ x: 720 }}
              dataSource={records}
              columns={RESULT_COLUMNS}
              pagination={false}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedRecord ? [selectedRecord.id] : [],
                onSelect: (record) => setSelectedRecord(record),
              }}
              onRow={(record) => ({
                onClick: () => setSelectedRecord(record),
                className: "cursor-pointer",
              })}
            />
          </div>
        ) : null}

        {selectedRecord ? (
          <RejectForm
            record={selectedRecord}
            onSaved={(updated) => {
              setSelectedRecord(updated);
              setRecords((prev) =>
                prev.map((row) => (row.id === updated.id ? updated : row)),
              );
            }}
          />
        ) : null}
      </Spin>
    </div>
  );
}
