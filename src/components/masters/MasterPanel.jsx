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
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const hasNameEn = masterKey === "companies" || masterKey === "problems";
  const isCompanies = masterKey === "companies";

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

  const loadCompanies = async () => {
    if (!hasCompany) return;
    try {
      const result = await masterApi.list("companies", {
        activeOnly: "1",
        pageSize: 5000,
      });
      setCompanies(result.data || []);
    } catch {
      setCompanies([]);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [masterKey]);

  useEffect(() => {
    loadCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompany, masterKey]);

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ is_active: true, name_en: "", aliases: [] });
    setOpen(true);
  };

  const openEdit = async (row) => {
    setEditing(row);
    form.resetFields();
    if (isCompanies) {
      try {
        const aliasResult = await masterApi.list("customer-aliases", {
          company_id: row.id,
          activeOnly: "1",
          pageSize: 500,
        });
        form.setFieldsValue({
          name: row.name,
          name_en: row.name_en || "",
          is_active: Boolean(row.is_active),
          aliases: (aliasResult.data || []).map((item) => item.name),
        });
      } catch (err) {
        message.error(err.message);
        return;
      }
    } else {
      form.setFieldsValue({
        name: row.name,
        name_en: row.name_en || "",
        company_id: row.company_id,
        is_active: Boolean(row.is_active),
      });
    }
    setOpen(true);
  };

  const columns = useMemo(() => {
    const cols = [{ title: "ชื่อ", dataIndex: "name" }];
    if (hasNameEn) {
      cols.push({
        title: "ชื่ออังกฤษ",
        dataIndex: "name_en",
        render: (value) => value || "-",
      });
    }
    cols.push({
      title: "สถานะ",
      dataIndex: "is_active",
      width: 100,
      render: (value) => (value ? "ใช้งาน" : "ปิด"),
    });
    if (hasCompany) {
      cols.unshift({ title: "บริษัท", dataIndex: "company_name" });
    }
    cols.push({
      title: "",
      key: "actions",
      width: 100,
      render: (_, row) => (
        <Button size="small" onClick={() => openEdit(row)}>
          แก้ไข
        </Button>
      ),
    });
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasCompany, hasNameEn, isCompanies]);

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
        <Button type="primary" onClick={openCreate}>
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
        title={editing ? "แก้ไข" : "เพิ่ม"}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={saving}
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            setSaving(true);
            try {
              const payload = { ...values };
              if (isCompanies) {
                payload.aliases = Array.isArray(values.aliases) ? values.aliases : [];
              }
              if (editing) {
                await masterApi.update(masterKey, editing.id, payload);
                message.success("บันทึกแล้ว");
              } else {
                await masterApi.create(masterKey, payload);
                message.success("เพิ่มแล้ว");
              }
              setOpen(false);
              load();
              if (isCompanies) loadCompanies();
            } catch (err) {
              message.error(err.message);
            } finally {
              setSaving(false);
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
                  label: item.name_en
                    ? `${item.name} (${item.name_en})`
                    : item.name,
                }))}
              />
            </Form.Item>
          ) : null}
          <Form.Item
            label={isCompanies ? "ชื่อบริษัท" : "ชื่อ"}
            name="name"
            rules={[{ required: true, message: "กรอกชื่อ" }]}
          >
            <Input placeholder={isCompanies ? "เช่น บริษัท เอเอเอ จำกัด" : undefined} />
          </Form.Item>
          {hasNameEn ? (
            <Form.Item label="ชื่ออังกฤษ" name="name_en">
              <Input placeholder="เช่น AAA Company" />
            </Form.Item>
          ) : null}
          {isCompanies ? (
            <Form.Item
              label="ชื่อเล่น"
              name="aliases"
              extra="ไม่บังคับ — พิมพ์แล้วกด Enter เพื่อเพิ่มได้หลายชื่อ"
            >
              <Select
                mode="tags"
                placeholder="เช่น เอเอเอ"
                tokenSeparators={[","]}
                open={false}
              />
            </Form.Item>
          ) : null}
          <Form.Item label="ใช้งาน" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
