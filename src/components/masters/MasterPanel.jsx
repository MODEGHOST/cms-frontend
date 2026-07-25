import { useEffect, useMemo, useState } from "react";
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
} from "antd";
import { masterApi } from "../../services/api";

export function MasterPanel({ masterKey, hasCompany }) {
  const { message } = App.useApp();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [companies, setCompanies] = useState([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const load = async (next = {}) => {
    setLoading(true);
    try {
      const result = await masterApi.list(masterKey, {
        q: next.q ?? q,
        page: next.page ?? page,
        pageSize: next.pageSize ?? pageSize,
      });
      setRows(result.data || []);
      setTotal(result.pagination?.total || 0);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  useEffect(() => {
    if (!hasCompany) return;
    masterApi
      .list("companies", { activeOnly: "1", pageSize: 200 })
      .then((result) => setCompanies(result.data || []))
      .catch(() => setCompanies([]));
  }, [hasCompany]);

  const columns = useMemo(() => {
    const cols = [
      { title: "ชื่อ", dataIndex: "name" },
      {
        title: "สถานะ",
        dataIndex: "is_active",
        width: 100,
        render: (value) => (value ? "ใช้งาน" : "ปิด"),
      },
    ];
    if (hasCompany) {
      cols.unshift({ title: "บริษัท", dataIndex: "company_name" });
    }
    cols.push({
      title: "",
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button
          size="small"
          onClick={() => {
            setEditing(row);
            form.setFieldsValue({
              name: row.name,
              company_id: row.company_id,
              is_active: Boolean(row.is_active),
            });
            setOpen(true);
          }}
        >
          แก้ไข
        </Button>
      ),
    });
    return cols;
  }, [form, hasCompany]);

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }}>
        <Input.Search
          allowClear
          placeholder="ค้นหา..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onSearch={(value) => {
            setQ(value);
            setPage(1);
            load({ q: value, page: 1 });
          }}
          style={{ width: 280 }}
        />
        <Button
          type="primary"
          onClick={() => {
            setEditing(null);
            form.resetFields();
            form.setFieldsValue({ is_active: true });
            setOpen(true);
          }}
        >
          เพิ่ม
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={rows}
        columns={columns}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextSize) => {
            setPage(nextPage);
            setPageSize(nextSize);
            load({ page: nextPage, pageSize: nextSize });
          },
        }}
      />

      <Modal
        title={editing ? "แก้ไข Master" : "เพิ่ม Master"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            try {
              if (editing) {
                await masterApi.update(masterKey, editing.id, values);
                message.success("บันทึกแล้ว");
              } else {
                await masterApi.create(masterKey, values);
                message.success("เพิ่มแล้ว");
              }
              setOpen(false);
              load();
            } catch (err) {
              message.error(err.message);
            }
          }}
        >
          {hasCompany ? (
            <Form.Item
              label="บริษัท"
              name="company_id"
              rules={[{ required: true, message: "เลือกบริษัท" }]}
            >
              <Select
                showSearch
                optionFilterProp="label"
                options={companies.map((item) => ({
                  value: item.id,
                  label: item.name,
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="ชื่อ" name="name" rules={[{ required: true, message: "กรอกชื่อ" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="ใช้งาน" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
