import { Button, Space, Table } from "antd";
import { PageHeader } from "../components/ui/PageHeader";

export function RejectsPage() {
  return (
    <div>
      <PageHeader
        title="รายการ Reject"
        description="บันทึก / ค้นหา / Import จาก Excel"
        extra={
          <Space>
            <Button>Import Excel</Button>
            <Button type="primary">เพิ่มรายการ</Button>
          </Space>
        }
      />
      <Table
        rowKey="id"
        dataSource={[]}
        columns={[
          { title: "รับ Reject", dataIndex: "reject_received_date" },
          { title: "บริษัท", dataIndex: "company_name" },
          { title: "เครื่อง", dataIndex: "machine_name" },
          { title: "ปัญหา", dataIndex: "problem_name" },
          { title: "แผนก", dataIndex: "department_name" },
        ]}
        locale={{ emptyText: "ยังไม่มีข้อมูล — รอเชื่อม API / Import" }}
      />
    </div>
  );
}
