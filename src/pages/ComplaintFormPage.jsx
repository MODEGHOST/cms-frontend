import { useState } from "react";
import { FileSearchOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Input, Spin, Table, Typography } from "antd";
import { ComplaintForm } from "../components/forms/ComplaintForm";
import { PageHeader } from "../components/ui/PageHeader";
import { complaintApi } from "../services/api";
import { formatDate } from "../utils/datetime";

const RESULT_COLUMNS = [
  { title: "PDR", dataIndex: "pdr_no" },
  { title: "ลูกค้า", dataIndex: "company_name", render: (value) => value || "-" },
  { title: "สินค้า", dataIndex: "product_name", render: (value) => value || "-" },
  { title: "วันที่รับเรื่อง", dataIndex: "received_date", render: formatDate },
  {
    title: "สถานะ",
    dataIndex: "workflow_status",
    render: (value) =>
      ({
        cs_draft: "รอ CS",
        pending_qa: "รอ QA รับเรื่อง",
        qa_review: "รอ QA",
        pending_department: "รอหน่วยงานรับเรื่อง",
        department_action: "หน่วยงานกำลังดำเนินการ",
        qa_confirm: "รอ QA Confirm",
        completed: "เสร็จสิ้น",
      })[value] || value,
  },
];

export function ComplaintFormPage() {
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
      const result = await complaintApi.searchByPdr(pdrNo);
      const rows = result.data || [];
      setRecords(rows);
      if (rows.length === 1) setSelectedRecord(rows[0]);
    } catch (error) {
      message.error(error.message || "ไม่สามารถค้นหาข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const updateRecord = (updated) => {
    setSelectedRecord(updated);
    setRecords((previous) =>
      previous.map((record) => (record.id === updated.id ? updated : record)),
    );
  };

  return (
    <div>
      <PageHeader
        title="ฟอร์ม Complaint"
        description="ค้นหาด้วยเลข PDR และทำงานตามลำดับ CS → QA → หน่วยงาน → QA Confirm"
      />

      <div className="mx-auto mb-5 max-w-4xl rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-xl text-red-700">
              <FileSearchOutlined />
            </div>
            <div>
              <Typography.Title level={5} className="!mb-0">
                ค้นหา Complaint ด้วยเลข PDR
              </Typography.Title>
              <Typography.Text type="secondary">
                ข้อมูลนำเข้าจากทะเบียนข้อร้องเรียน Sheet 2026
              </Typography.Text>
            </div>
          </div>
          <Input.Search
            className="w-full lg:!w-[430px]"
            size="large"
            allowClear
            enterButton="ค้นหา"
            placeholder="เช่น PDR2601-01291"
            onSearch={searchByPdr}
            loading={loading}
          />
        </div>
      </div>

      <Spin spinning={loading}>
        {!loading && searched && records.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <Empty description="ไม่พบข้อมูล Complaint สำหรับเลข PDR นี้" />
          </div>
        ) : null}

        {records.length > 1 ? (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={`พบ ${records.length} รายการ กรุณาเลือกรายการที่ต้องการ`}
            />
            <Table
              rowKey="id"
              size="small"
              scroll={{ x: 760 }}
              dataSource={records}
              columns={RESULT_COLUMNS}
              pagination={false}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedRecord ? [selectedRecord.id] : [],
                onSelect: setSelectedRecord,
              }}
              onRow={(record) => ({
                onClick: () => setSelectedRecord(record),
                className: "cursor-pointer",
              })}
            />
          </div>
        ) : null}

        {selectedRecord ? (
          <ComplaintForm record={selectedRecord} onSaved={updateRecord} />
        ) : null}
      </Spin>
    </div>
  );
}
