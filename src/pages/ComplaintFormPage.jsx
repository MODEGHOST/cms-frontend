import { useEffect, useState } from "react";
import { FileSearchOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Input, Spin, Table, Typography } from "antd";
import { useSearchParams } from "react-router-dom";
import { ComplaintForm } from "../components/forms/ComplaintForm";
import { PageHeader } from "../components/ui/PageHeader";
import { COMPLAINT_WORKFLOW_LABELS } from "../constants/complaintWorkflow";
import { complaintApi, erpApi } from "../services/api";
import { buildErpDraftRecord } from "../utils/mapErpPdr";
import { formatDate } from "../utils/datetime";

const RESULT_COLUMNS = [
  { title: "PDR", dataIndex: "pdr_no" },
  { title: "ลูกค้า", dataIndex: "company_name", render: (value) => value || "-" },
  { title: "สินค้า", dataIndex: "product_name", render: (value) => value || "-" },
  { title: "วันที่รับเรื่อง", dataIndex: "received_date", render: (value) => formatDate(value) },
  {
    title: "สถานะ",
    dataIndex: "workflow_status",
    render: (value) => COMPLAINT_WORKFLOW_LABELS[value] || value,
  },
];

export function ComplaintFormPage() {
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [records, setRecords] = useState([]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [searchValue, setSearchValue] = useState("");

  const searchByPdr = async (rawValue, preferredId) => {
    const pdrNo = String(rawValue || "").trim();
    if (!pdrNo) {
      message.warning("กรุณากรอกเลข PDR");
      return;
    }
    setLoading(true);
    setSearched(true);
    setSearchValue(pdrNo);
    setRecords([]);
    setSelectedRecord(null);
    try {
      // มีใน CMS แล้ว → GET อย่างเดียว
      const existing = await complaintApi.searchByPdr(pdrNo);
      let rows = existing.data || [];

      if (!rows.length) {
        // ไม่มีใน CMS → GET ERP มาโชว์อย่างเดียว (ยังไม่ INSERT)
        const erpResult = await erpApi.getPdr(pdrNo);
        if (!erpResult?.enabled) {
          message.error(
            erpResult?.error ||
              "ยังไม่ได้เปิด ERP (ตั้ง ERP_API_ENABLED=1 และรัน Beta_api_erp)",
          );
          return;
        }
        if (!erpResult.ok) {
          message.error(erpResult.error || "เรียก ERP ไม่สำเร็จ");
          return;
        }
        const erpRow = erpResult.data?.[0];
        if (!erpRow) {
          message.warning("ไม่พบเลข PDR นี้ใน ERP");
          return;
        } 
        const draft = buildErpDraftRecord(erpRow, "complaint");
        rows = [draft];
        message.info("ดึงจาก ERP แล้ว — ยังไม่บันทึกลง CMS จนกว่า CS จะส่งข้อมูล");
      }

      setRecords(rows);
      if (!rows.length) {
        message.warning("ไม่พบข้อมูลสำหรับเลข PDR นี้");
        return;
      }
      const preferred = preferredId
        ? rows.find((row) => Number(row.id) === Number(preferredId))
        : null;
      if (preferred) setSelectedRecord(preferred);
      else if (rows.length === 1) setSelectedRecord(rows[0]);
    } catch (error) {
      message.error(error.message || "ไม่สามารถค้นหาข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const pdr = String(searchParams.get("pdr") || "").trim();
    const id = searchParams.get("id");
    if (!pdr) return;
    searchByPdr(pdr, id);
    // deep-link once per querystring
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const updateRecord = (updated) => {
    setSelectedRecord(updated);
    setRecords((previous) => {
      if (!previous.length) return updated ? [updated] : [];
      const matched = previous.some(
        (row) =>
          (row.id == null && updated?.id != null) ||
          (row.id != null && Number(row.id) === Number(updated.id)),
      );
      if (!matched) return updated ? [...previous, updated] : previous;
      return previous.map((row) =>
        (row.id == null && updated?.id != null) ||
        (row.id != null && Number(row.id) === Number(updated.id))
          ? updated
          : row,
      );
    });
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
                มีใน CMS จะเปิดใบเดิม — ไม่มีจะดึง ERP มาโชว์ (บันทึกเมื่อ CS ส่งข้อมูล)
              </Typography.Text>
            </div>
          </div>
          <Input.Search
            className="w-full lg:!w-[430px]"
            size="large"
            allowClear
            enterButton="ค้นหา"
            placeholder="เช่น PDR2601-01291"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onSearch={(value) => searchByPdr(value)}
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

        {records.length > 1 && !selectedRecord ? (
          <div className="mb-4 rounded-2xl bg-white p-4 shadow-sm md:p-6">
            <Alert
              className="mb-4"
              type="info"
              showIcon
              message={`พบ ${records.length} รายการ กรุณาเลือกรายการที่ต้องการ`}
            />
            <Table
              rowKey={(row) => row.id ?? `draft-${row.pdr_no}`}
              size="small"
              scroll={{ x: 760 }}
              dataSource={records}
              columns={RESULT_COLUMNS}
              pagination={false}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedRecord
                  ? [selectedRecord.id ?? `draft-${selectedRecord.pdr_no}`]
                  : [],
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
