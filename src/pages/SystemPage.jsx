import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  ApartmentOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Navigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { useSession } from "../hooks/useSession";
import { masterApi, systemApi } from "../services/api";
import { canManageSystem } from "../utils/authz";
import {
  STAFF_BASE_PERMISSIONS,
  WORKFLOW_PERMISSION_LABELS,
  listDepartmentWorkMatrix,
} from "../utils/departmentPermissions";

const PERMISSION_GROUP_LABELS = {
  activity: "Activity Log",
  complaints: "Complaint",
  dashboard: "Dashboard",
  masters: "Master Data",
  members: "สมาชิก",
  rejects: "Reject",
  system: "ระบบ",
  other: "อื่น ๆ",
};

const ROLE_TAG_COLOR = {
  developer: "purple",
  admin: "red",
  staff: "blue",
  viewer: "default",
};

const LEGACY_WORKFLOW_ROLE_NAMES = new Set(["cs", "qa", "qc", "department"]);

const ALL_DEPARTMENTS_KEY = "__all__";
const NO_DEPARTMENT_KEY = "__none__";

function MembersPanel({ roles }) {
  const { message, modal } = App.useApp();
  const { user: me, refresh } = useSession();
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState(ALL_DEPARTMENTS_KEY);
  const [departmentFacets, setDepartmentFacets] = useState([]);
  const [memberPaging, setMemberPaging] = useState({ page: 1, pageSize: 6, total: 0 });
  const [addOpen, setAddOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [departmentOptions, setDepartmentOptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [addForm] = Form.useForm();
  const [profileForm] = Form.useForm();
  const watchedAddRoles = Form.useWatch("roles", addForm);
  const departmentFilterRef = useRef(departmentFilter);

  const roleOptions = useMemo(
    () =>
      (roles || [])
        .filter((role) => !LEGACY_WORKFLOW_ROLE_NAMES.has(role.name))
        .map((role) => ({
          value: role.name,
          label: role.label || role.name,
        })),
    [roles],
  );

  const departmentTabItems = useMemo(() => {
    const items = [{ key: ALL_DEPARTMENTS_KEY, label: "ทั้งหมด" }];
    for (const row of departmentFacets) {
      if (!row.department) {
        items.push({ key: NO_DEPARTMENT_KEY, label: "ไม่มีแผนก" });
      } else {
        items.push({ key: row.department, label: row.department });
      }
    }
    return items;
  }, [departmentFacets]);

  useEffect(() => {
    departmentFilterRef.current = departmentFilter;
  }, [departmentFilter]);

  useEffect(() => {
    masterApi
      .list("departments", { pageSize: 200 })
      .then((result) => {
        setDepartmentOptions(
          (result.data || [])
            .filter((row) => Number(row.is_active) !== 0)
            .map((row) => ({ value: row.name, label: row.name })),
        );
      })
      .catch(() => {});
  }, []);

  async function loadMembers({
    search = q,
    page = memberPaging.page,
    pageSize = memberPaging.pageSize,
    department = departmentFilterRef.current,
  } = {}) {
    setLoading(true);
    try {
      const result = await systemApi.listMembers({
        q: search || undefined,
        department: department === ALL_DEPARTMENTS_KEY ? undefined : department,
        page,
        pageSize,
      });
      const facets = result.departments || [];
      const filterStillValid =
        department === ALL_DEPARTMENTS_KEY ||
        facets.some((row) =>
          department === NO_DEPARTMENT_KEY
            ? !row.department
            : row.department === department,
        );

      if (!filterStillValid) {
        setDepartmentFilter(ALL_DEPARTMENTS_KEY);
        departmentFilterRef.current = ALL_DEPARTMENTS_KEY;
        const allResult = await systemApi.listMembers({
          q: search || undefined,
          page: 1,
          pageSize,
        });
        setMembers(allResult.data || []);
        setDepartmentFacets(allResult.departments || []);
        setMemberPaging({
          page: allResult.pagination?.page || 1,
          pageSize: allResult.pagination?.pageSize || pageSize,
          total: allResult.pagination?.total || 0,
        });
        return;
      }

      setMembers(result.data || []);
      setDepartmentFacets(facets);
      setMemberPaging({
        page: result.pagination?.page || page,
        pageSize: result.pagination?.pageSize || pageSize,
        total: result.pagination?.total || 0,
      });
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMembers({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateRoles(userId, nextRoles) {
    if (!nextRoles?.length) {
      message.error("ต้องมีอย่างน้อย 1 role");
      return;
    }
    const member = members.find((row) => row.id === userId);
    if (nextRoles.includes("staff") && !member?.department) {
      message.error("Role พนักงานต้องระบุแผนกก่อน — แก้ที่โปรไฟล์");
      return;
    }
    setSavingId(userId);
    try {
      await systemApi.updateMember(userId, { roles: nextRoles });
      message.success("อัปเดต Role แล้ว");
      await loadMembers();
      if (userId === me?.id) await refresh();
    } catch (error) {
      message.error(error.message);
      await loadMembers();
    } finally {
      setSavingId(null);
    }
  }

  async function toggleActive(row, nextActive) {
    setSavingId(row.id);
    try {
      await systemApi.updateMember(row.id, { is_active: nextActive });
      message.success(nextActive ? "เปิดใช้งานแล้ว" : "ระงับการใช้งานแล้ว");
      await loadMembers();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSavingId(null);
    }
  }

  async function openAdd() {
    addForm.resetFields();
    addForm.setFieldsValue({ roles: ["staff"] });
    setAddOpen(true);
    try {
      const result = await systemApi.listCenterUsers({ without_membership: 1 });
      setCandidates(result.data || []);
    } catch (error) {
      message.error(error.message);
    }
  }

  function openProfile(record) {
    setCurrent(record);
    profileForm.setFieldsValue({
      display_name: record.display_name,
      department: record.department,
    });
    setProfileOpen(true);
  }

  async function saveProfile() {
    const values = await profileForm.validateFields();
    setSaving(true);
    try {
      await systemApi.updateMember(current.id, values);
      message.success("บันทึกโปรไฟล์แล้ว");
      setProfileOpen(false);
      await loadMembers();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAdd() {
    const values = await addForm.validateFields();
    setSaving(true);
    try {
      await systemApi.createMember({
        user_id: values.user_id,
        roles: values.roles,
        department: values.department || null,
      });
      message.success("เพิ่มสมาชิก CMS แล้ว");
      setAddOpen(false);
      await loadMembers();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmRevoke(record) {
    modal.confirm({
      centered: true,
      title: "ยืนยันการถอนสิทธิ์ CMS",
      content: (
        <div className="mt-3 space-y-3">
          <div>
            ต้องการถอนสิทธิ์ของ <strong>{record.display_name}</strong> (
            {record.username}) ใช่หรือไม่
          </div>
          <Alert
            showIcon
            type="info"
            message="บัญชีกลางยังอยู่"
            description="ผู้ใช้จะเข้า CMS ไม่ได้จนกว่าจะเปิดสิทธิ์ใหม่จากเมนูนี้"
          />
        </div>
      ),
      okText: "ถอนสิทธิ์",
      okButtonProps: { danger: true },
      cancelText: "ยกเลิก",
      onOk: async () => {
        try {
          await systemApi.revokeMember(record.id);
          message.success("ถอนสิทธิ์แล้ว");
          await loadMembers();
        } catch (error) {
          message.error(error.message);
        }
      },
    });
  }

  function onDepartmentTabChange(key) {
    setDepartmentFilter(key);
    departmentFilterRef.current = key;
    loadMembers({ search: q, page: 1, department: key });
  }

  return (
    <>
      <div className="members-department-tabs mb-3" role="tablist" aria-label="กรองตามแผนก">
        {departmentTabItems.map((tab) => {
          const active = departmentFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`members-department-tab${active ? " is-active" : ""}`}
              onClick={() => onDepartmentTabChange(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Space.Compact className="min-w-[260px] flex-1">
          <Input
            allowClear
            placeholder="ค้นหา username / ชื่อ / อีเมล"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onPressEnter={() => loadMembers({ search: q, page: 1 })}
          />
          <Button onClick={() => loadMembers({ search: q, page: 1 })}>ค้นหา</Button>
        </Space.Compact>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadMembers()}>
            รีเฟรช
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openAdd}>
            เพิ่มสมาชิก
          </Button>
        </Space>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={members}
          scroll={{ x: 1000 }}
          pagination={{
            current: memberPaging.page,
            pageSize: memberPaging.pageSize,
            total: memberPaging.total,
            showSizeChanger: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} จาก ${total} รายการ`,
            onChange: (page, pageSize) =>
              loadMembers({ search: q, page, pageSize }),
          }}
          columns={[
            {
              title: "พนักงาน",
              key: "name",
              render: (_, row) => (
                <div>
                  <div className="font-medium text-slate-800">
                    {row.display_name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {row.username} · {row.email}
                  </div>
                </div>
              ),
            },
            {
              title: "แผนก",
              dataIndex: "department",
              width: 140,
              render: (value) => value || "-",
            },
            {
              title: "สถานะ",
              dataIndex: "is_active",
              width: 120,
              render: (active) => (
                <Tag color={active ? "green" : "red"}>
                  {active ? "ใช้งาน" : "ระงับ"}
                </Tag>
              ),
            },
            {
              title: "Role",
              key: "roles",
              width: 280,
              render: (_, row) => (
                <Select
                  mode="multiple"
                  className="w-full"
                  value={row.roles || []}
                  options={roleOptions}
                  disabled={savingId === row.id}
                  onChange={(values) => updateRoles(row.id, values)}
                  tagRender={({ value, closable, onClose }) => (
                    <Tag
                      color={ROLE_TAG_COLOR[value] || "default"}
                      closable={closable}
                      onClose={onClose}
                      style={{ marginInlineEnd: 4 }}
                    >
                      {roleOptions.find((o) => o.value === value)?.label || value}
                    </Tag>
                  )}
                />
              ),
            },
            {
              title: "จัดการ",
              key: "actions",
              fixed: "right",
              width: 250,
              render: (_, row) => (
                <Space wrap>
                  <Button size="small" onClick={() => openProfile(row)}>
                    โปรไฟล์
                  </Button>
                  {row.is_active ? (
                    <Button
                      danger
                      size="small"
                      icon={<StopOutlined />}
                      loading={savingId === row.id}
                      disabled={row.id === me?.id}
                      onClick={() => toggleActive(row, false)}
                    >
                      ระงับ
                    </Button>
                  ) : (
                    <Button
                      size="small"
                      loading={savingId === row.id}
                      onClick={() => toggleActive(row, true)}
                    >
                      เปิดใช้งาน
                    </Button>
                  )}
                  <Button
                    danger
                    size="small"
                    disabled={row.id === me?.id}
                    onClick={() => confirmRevoke(row)}
                  >
                    ถอนสิทธิ์
                  </Button>
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title="เพิ่มสมาชิกจากบัญชีกลาง"
        open={addOpen}
        centered
        onCancel={() => setAddOpen(false)}
        onOk={saveAdd}
        confirmLoading={saving}
        destroyOnHidden
        okText="เพิ่มสมาชิก"
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="เลือกจาก Center_user_lfb ที่ยังไม่มีสิทธิ์ CMS"
        />
        <Form form={addForm} layout="vertical">
          <Form.Item
            name="user_id"
            label="บัญชีกลาง"
            rules={[{ required: true, message: "เลือกผู้ใช้" }]}
          >
            <Select
              showSearch
              optionFilterProp="label"
              options={candidates.map((c) => ({
                value: c.id,
                label: `${c.display_name || c.username} (${c.username})`,
              }))}
              placeholder="ค้นหาและเลือกผู้ใช้"
            />
          </Form.Item>
          <Form.Item
            name="department"
            label="แผนก"
            extra="สิทธิ์งาน Complaint/Reject มาจากแผนก (เช่น MKT → CS, QA → QA)"
            rules={
              (watchedAddRoles || []).includes("staff")
                ? [{ required: true, message: "พนักงานต้องเลือกแผนก" }]
                : []
            }
          >
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="เลือกแผนกจาก Master"
              options={departmentOptions}
            />
          </Form.Item>
          <Form.Item
            name="roles"
            label="Role"
            extra="ระดับสิทธิ์เท่านั้น — ไม่ใช่แผนก"
            rules={[{ required: true, message: "กรุณาเลือก Role" }]}
          >
            <Select mode="multiple" options={roleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`โปรไฟล์ · ${current?.username || ""}`}
        open={profileOpen}
        centered
        onCancel={() => setProfileOpen(false)}
        onOk={saveProfile}
        confirmLoading={saving}
        destroyOnHidden
        okText="บันทึก"
      >
        <Form form={profileForm} layout="vertical" className="mt-2">
          <Form.Item name="display_name" label="ชื่อที่แสดง">
            <Input />
          </Form.Item>
          <Form.Item
            name="department"
            label="แผนก"
            extra="ใช้ใน workflow และ Auto หน่วยงานที่แจ้งปัญหา (ตอน CS ส่งเรื่อง)"
            rules={
              (current?.roles || []).includes("staff")
                ? [{ required: true, message: "พนักงานต้องเลือกแผนก" }]
                : []
            }
          >
            <Select
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder="เลือกแผนกจาก Master"
              options={departmentOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

function DepartmentWorkPanel({ permissions }) {
  const matrix = useMemo(() => listDepartmentWorkMatrix(), []);
  const permissionLabelByCode = useMemo(() => {
    const map = {};
    for (const permission of permissions || []) {
      map[permission.code] = permission.description || permission.code;
    }
    return map;
  }, [permissions]);

  const groups = useMemo(() => {
    const byCode = {};
    for (const code of Object.keys(WORKFLOW_PERMISSION_LABELS)) {
      byCode[code] = [];
    }
    for (const row of matrix) {
      for (const code of row.permissions || []) {
        if (!byCode[code]) byCode[code] = [];
        byCode[code].push(row.department);
      }
    }
    return Object.entries(WORKFLOW_PERMISSION_LABELS).map(([code, label]) => ({
      code,
      label,
      departments: byCode[code] || [],
    }));
  }, [matrix]);

  return (
    <div className="space-y-4">
      <Alert
        type="info"
        showIcon
        message="สิทธิ์งานของ Role พนักงาน"
        description="กำหนดจากแผนกที่สังกัดอัตโนมัติ — ไม่ต้องติ๊กทีละคน แก้กฎในระบบแล้วแผนกทุกคนในแผนกนั้นได้สิทธิ์ตามนี้"
      />

      <Card className="rounded-2xl shadow-sm">
        <div className="mb-3">
          <div className="text-base font-semibold text-slate-800">
            สิทธิ์พื้นฐานของพนักงาน
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {STAFF_BASE_PERMISSIONS.map((code) => (
              <Tag key={code} className="!mr-0">
                {permissionLabelByCode[code] || code}
              </Tag>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.map((group) => (
          <Card key={group.code} className="rounded-2xl shadow-sm" size="small">
            <div className="mb-2 font-semibold text-slate-800">{group.label}</div>
            <div className="mb-2 text-xs text-slate-400">{group.code}</div>
            <div className="flex flex-wrap gap-1.5">
              {group.departments.length ? (
                group.departments.map((dept) => (
                  <Tag key={dept} color="blue" className="!mr-0">
                    {dept}
                  </Tag>
                ))
              ) : (
                <span className="text-sm text-slate-400">ยังไม่มีแผนก</span>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl shadow-sm">
        <div className="mb-3 text-base font-semibold text-slate-800">
          รายการทุกแผนก
        </div>
        <Table
          rowKey="department"
          size="small"
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} จาก ${total} แผนก`,
          }}
          dataSource={matrix}
          columns={[
            {
              title: "แผนก",
              dataIndex: "department",
              width: 120,
              render: (value) => (
                <span className="font-medium text-slate-800">{value}</span>
              ),
            },
            {
              title: "สิทธิ์งานที่ได้",
              dataIndex: "work_summary",
              render: (value, row) =>
                row.permissions?.length ? (
                  <div className="flex flex-wrap gap-1">
                    {row.labels.map((label, index) => (
                      <Tag key={`${row.department}-${index}`} color="blue">
                        {label}
                      </Tag>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">{value}</span>
                ),
            },
            {
              title: "รหัส",
              key: "codes",
              width: 220,
              render: (_, row) =>
                row.permissions?.length ? row.permissions.join(", ") : "-",
            },
          ]}
        />
      </Card>
    </div>
  );
}

function RolesPanel({ roles, permissions, onChanged }) {
  const { message, modal } = App.useApp();
  const [selectedRole, setSelectedRole] = useState(null);
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form] = Form.useForm();

  const grouped = useMemo(() => {
    const groups = {};
    for (const permission of permissions || []) {
      const group = permission.code?.split(".")[0] || "other";
      if (!groups[group]) groups[group] = [];
      groups[group].push(permission);
    }
    return groups;
  }, [permissions]);

  function editRole(role) {
    setSelectedRole(role);
    const codes = new Set(role.permissions || []);
    setSelectedPermissions(
      (permissions || [])
        .filter((permission) => codes.has(permission.code))
        .map((permission) => permission.id),
    );
  }

  async function savePermissions() {
    if (!selectedRole?.can_edit_permissions) return;
    setSaving(true);
    try {
      await systemApi.updateRolePermissions(selectedRole.id, selectedPermissions);
      message.success("บันทึก Permission แล้ว");
      setSelectedRole(null);
      await onChanged?.();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function createRole(values) {
    setSaving(true);
    try {
      await systemApi.createRole(values);
      message.success("สร้าง Custom Role แล้ว");
      setCreateOpen(false);
      form.resetFields();
      await onChanged?.();
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(role) {
    modal.confirm({
      centered: true,
      title: `ลบ Role “${role.label}”?`,
      content: "ลบได้เฉพาะ Custom Role ที่ยังไม่ถูกมอบหมาย",
      okText: "ลบ",
      okButtonProps: { danger: true },
      cancelText: "ยกเลิก",
      onOk: async () => {
        try {
          await systemApi.deleteRole(role.id);
          message.success("ลบ Role แล้ว");
          await onChanged?.();
        } catch (error) {
          message.error(error.message);
        }
      },
    });
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          type="primary"
          icon={<KeyOutlined />}
          onClick={() => setCreateOpen(true)}
        >
          สร้าง Custom Role
        </Button>
      </div>

      <Card className="rounded-2xl shadow-sm">
        <Table
          rowKey="id"
          dataSource={roles}
          pagination={false}
          columns={[
            {
              title: "Role",
              key: "name",
              render: (_, role) => (
                <div>
                  <div className="font-medium text-slate-800">
                    {role.label || role.name}
                  </div>
                  <div className="text-xs text-slate-400">{role.name}</div>
                </div>
              ),
            },
            {
              title: "คำอธิบาย",
              dataIndex: "description",
              render: (value) => value || "-",
            },
            {
              title: "Permission",
              key: "permission_count",
              width: 140,
              render: (_, role) =>
                `${(role.permissions || []).length} รายการ`,
            },
            {
              title: "ประเภท",
              key: "type",
              width: 120,
              render: (_, role) => (
                <Tag color={role.is_system ? "blue" : "purple"}>
                  {role.is_system ? "Built-in" : "Custom"}
                </Tag>
              ),
            },
            {
              title: "",
              key: "action",
              align: "right",
              width: 260,
              render: (_, role) => (
                <Space>
                  <Button onClick={() => editRole(role)}>
                    {role.can_edit_permissions
                      ? "จัดการ Permission"
                      : "ดู Permission"}
                  </Button>
                  {!role.is_system ? (
                    <Button danger onClick={() => confirmDelete(role)}>
                      ลบ
                    </Button>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={`Permission · ${selectedRole?.label || selectedRole?.name || ""}`}
        open={Boolean(selectedRole)}
        onCancel={() => setSelectedRole(null)}
        onOk={savePermissions}
        confirmLoading={saving}
        okButtonProps={{
          disabled: selectedRole?.can_edit_permissions !== true,
        }}
        okText={
          selectedRole?.can_edit_permissions ? "บันทึก" : "Built-in Role"
        }
        width={1100}
        centered
        styles={{
          body: { maxHeight: "calc(100vh - 180px)", overflowY: "auto" },
        }}
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="สิทธิ์แสดงเป็นภาษาไทย"
          description={
            selectedRole?.can_edit_permissions
              ? "Custom Role ไม่สามารถรับสิทธิ์จัดการระบบ / สมาชิก / manage_all ได้"
              : "Built-in Role แก้ไขไม่ได้ — สร้าง Custom Role หากต้องการชุดสิทธิ์เฉพาะ"
          }
        />
        <Checkbox.Group
          className="w-full"
          value={selectedPermissions}
          onChange={setSelectedPermissions}
        >
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(grouped).map(([group, items]) => (
              <div
                key={group}
                className="rounded-xl border border-slate-200 p-3"
              >
                <div className="mb-2 font-semibold text-slate-700">
                  {PERMISSION_GROUP_LABELS[group] || group}
                </div>
                <Space direction="vertical" size={8}>
                  {items.map((permission) => (
                    <Checkbox
                      key={permission.id}
                      value={permission.id}
                      disabled={
                        selectedRole?.can_edit_permissions !== true
                        || permission.grantable_to_custom_role === false
                      }
                    >
                      <div>
                        <div className="text-sm text-slate-800">
                          {permission.description || permission.code}
                        </div>
                        <div className="text-xs text-slate-400">
                          {permission.code}
                        </div>
                      </div>
                    </Checkbox>
                  ))}
                </Space>
              </div>
            ))}
          </div>
        </Checkbox.Group>
      </Modal>

      <Modal
        title="สร้าง Custom Role"
        open={createOpen}
        centered
        footer={null}
        onCancel={() => setCreateOpen(false)}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={createRole}>
          <Form.Item
            name="label"
            label="ชื่อ Role"
            rules={[{ required: true, message: "กรุณากรอกชื่อ Role" }]}
          >
            <Input placeholder="เช่น Support, Team Lead" maxLength={120} />
          </Form.Item>
          <Form.Item name="description" label="คำอธิบาย">
            <Input.TextArea rows={3} maxLength={255} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={saving}>
            สร้าง Role
          </Button>
        </Form>
      </Modal>
    </>
  );
}

export function SystemPage() {
  const { message } = App.useApp();
  const { user } = useSession();
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadMeta() {
    setLoading(true);
    try {
      const [roleRes, permRes] = await Promise.all([
        systemApi.listRoles(),
        systemApi.listPermissions(),
      ]);
      setRoles(roleRes.data || []);
      setPermissions(permRes.data || []);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canManageSystem(user)) loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (!canManageSystem(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  const items = [
    {
      key: "members",
      label: (
        <span>
          <TeamOutlined /> สมาชิก
        </span>
      ),
      children: <MembersPanel roles={roles} />,
    },
    {
      key: "roles",
      label: (
        <span>
          <SafetyCertificateOutlined /> Role & Permission
        </span>
      ),
      children: (
        <RolesPanel
          roles={roles}
          permissions={permissions}
          onChanged={loadMeta}
        />
      ),
    },
    {
      key: "department-work",
      label: (
        <span>
          <ApartmentOutlined /> สิทธิ์ตามแผนก
        </span>
      ),
      children: <DepartmentWorkPanel permissions={permissions} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="สมาชิกและสิทธิ์"
        subtitle="เปิดสิทธิ์เข้า CMS จัดการ Role และ Permission — แยกจาก Identity กลาง / PRD RBAC"
        extra={
          <Button icon={<ReloadOutlined />} loading={loading} onClick={loadMeta}>
            รีเฟรช
          </Button>
        }
      />
      <Tabs destroyOnHidden items={items} />
    </div>
  );
}
