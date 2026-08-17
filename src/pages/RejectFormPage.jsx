import { useEffect, useState } from "react";
import { FileSearchOutlined } from "@ant-design/icons";
import { Alert, App, Empty, Input, Spin, Table, Typography } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import { RejectForm } from "../components/forms/RejectForm";
import { PageHeader } from "../components/ui/PageHeader";
import { erpApi, rejectApi } from "../services/api";
import { buildErpDraftRecord } from "../utils/mapErpPdr";
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
  const navigate = useNavigate();
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
      const existing = await rejectApi.searchByPdr(pdrNo);
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
        const draft = buildErpDraftRecord(erpRow, "reject");
        rows = [draft];
        message.info("ดึงจาก ERP แล้ว — ยังไม่บันทึกลง CMS จนกว่า QC จะกดบันทึก");
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

  const handleReturned = (returned) => {
    const returnedId = Number(returned?.id);
    setSelectedRecord(null);
    setRecords((previous) =>
      previous.filter((row) => Number(row.id) !== returnedId),
    );
    navigate("/rejects");
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
                มีใน CMS จะเปิดใบเดิม — ไม่มีจะดึง ERP มาโชว์ (บันทึกเมื่อ QC กดบันทึก)
              </Typography.Text>
            </div>
          </div>

          <div className="w-full shrink-0 lg:w-[430px]">
            <Input.Search
              size="large"
              allowClear
              enterButton="ค้นหา"
              placeholder="เช่น PDR2607-01267"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
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
              rowKey={(row) => row.id ?? `draft-${row.pdr_no}`}
              size="small"
              scroll={{ x: 720 }}
              dataSource={records}
              columns={RESULT_COLUMNS}
              pagination={false}
              rowSelection={{
                type: "radio",
                selectedRowKeys: selectedRecord
                  ? [selectedRecord.id ?? `draft-${selectedRecord.pdr_no}`]
                  : [],
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
            onSaved={updateRecord}
            onReturned={handleReturned}
          />
        ) : null}
      </Spin>
    </div>
  );
}
