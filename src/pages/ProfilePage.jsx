import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Form,
  Input,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  MailOutlined,
  SendOutlined,
  UsergroupAddOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../components/ui/PageHeader";
import { useSession } from "../hooks/useSession";
import { authApi } from "../services/api";

const ROLE_LABELS = {
  developer: "Developer",
  admin: "Admin",
  staff: "พนักงาน",
  viewer: "ผู้ดูอย่างเดียว",
  // legacy labels (if session still has old names before re-login)
  qc: "QC",
  qa: "QA",
  cs: "CS",
  department: "Department",
};

function ProfileField({ label, value, hint }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 text-xs font-medium tracking-wide text-slate-500">{label}</div>
      <div className="break-words text-[15px] leading-6 font-medium text-slate-800">
        {value || <span className="font-normal text-slate-400">ยังไม่ได้ระบุ</span>}
      </div>
      {hint ? <div className="mt-1.5 text-[11px] leading-4 text-slate-400">{hint}</div> : null}
    </div>
  );
}

export function ProfilePage() {
  const { user, refresh } = useSession();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [joiningGroup, setJoiningGroup] = useState(false);

  const nameParts = useMemo(() => {
    const first = String(user?.first_name || "").trim();
    const last = String(user?.last_name || "").trim();
    if (first || last) return { firstName: first, lastName: last };
    const full = String(user?.display_name || "").trim();
    if (!full) return { firstName: "", lastName: "" };
    const parts = full.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { firstName: parts[0], lastName: "" };
    return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    form.setFieldsValue({
      email: user.email || "",
      telegram_id: user.telegram_id || "",
    });
  }, [form, user, editing]);

  const cancelEdit = () => {
    form.setFieldsValue({
      email: user?.email || "",
      telegram_id: user?.telegram_id || "",
    });
    setEditing(false);
  };

  const save = async (values) => {
    setSaving(true);
    try {
      const data = await authApi.updateProfile({
        email: String(values.email || "").trim(),
        telegram_id: values.telegram_id || "",
      });
      message.success(data.message || "บันทึกข้อมูลแล้ว");
      await refresh();
      setEditing(false);
    } catch (error) {
      message.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const openLfbService = () => {
    if (!user?.telegram_bot_url) {
      message.error("ยังไม่ได้ตั้งค่า LFB Service bot");
      return;
    }
    window.open(user.telegram_bot_url, "_blank", "noopener,noreferrer");
  };

  const joinCmsGroup = async () => {
    setJoiningGroup(true);
    try {
      const data = await authApi.telegramGroup();
      if (!data?.inviteUrl) {
        throw new Error("ไม่พบลิงก์เข้ากลุ่ม");
      }
      window.open(data.inviteUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      message.error(error.message);
    } finally {
      setJoiningGroup(false);
    }
  };

  if (!user) return null;

  const needsTelegram = !user.telegram_id;
  const needsBotLink = !user.telegram_linked;
  const roleLabels = (user.roles || [user.role])
    .filter(Boolean)
    .map((role) => ROLE_LABELS[role] || role);

  const identityFields = (
    <div className="grid gap-5 rounded-xl border border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
      <ProfileField label="ชื่อ" value={nameParts.firstName} />
      <ProfileField label="นามสกุล" value={nameParts.lastName} />
      <ProfileField
        label="รหัสพนักงาน"
        value={user.username}
        hint="ใช้เข้าสู่ระบบ"
      />
      {!editing ? (
        <ProfileField
          label="อีเมล"
          value={user.email}
          hint="ใช้ยืนยันบัญชีและรีเซ็ตรหัสผ่าน"
        />
      ) : null}
      <ProfileField label="แผนก" value={user.department} />
    </div>
  );

  return (
    <div>
      <PageHeader
        title="ข้อมูลของฉัน"
        subtitle="ดูข้อมูลบัญชีที่สมัครไว้ ผูก Telegram / LFB Service และเข้ากลุ่มแจ้งเตือนได้จากหน้านี้"
        extra={
          editing ? (
            <Space wrap>
              <Button onClick={cancelEdit} disabled={saving}>
                ยกเลิก
              </Button>
              <Button type="primary" loading={saving} onClick={() => form.submit()}>
                บันทึก
              </Button>
            </Space>
          ) : (
            <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)}>
              แก้ไขข้อมูล
            </Button>
          )
        }
      />

      {needsTelegram && !editing ? (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="ยังไม่ได้กรอก Telegram ID"
          description="ทุกคนต้องกรอก Telegram ID แล้วผูก LFB Service ด้วย"
          action={
            <Button size="small" type="link" onClick={() => setEditing(true)}>
              แก้ไขเลย
            </Button>
          }
        />
      ) : null}

      {!needsTelegram && needsBotLink && !editing ? (
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          message="ยังไม่ได้ผูก LFB Service"
          description="ทุกคนต้องกดเปิดบอท LFB Service แล้วกด Start เพื่อผูกบัญชี ใช้ตอนลืมรหัสผ่านและยืนยันตัวตน"
          action={
            <Button size="small" type="primary" onClick={openLfbService}>
              ผูกเลย
            </Button>
          }
        />
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-red-50 px-6 py-7 md:px-8 md:py-8">
          <div className="flex flex-wrap items-center gap-5">
            <Avatar size={80} className="bg-red-700 text-2xl shadow-sm">
              {(user.display_name || nameParts.firstName || "?").slice(0, 1)}
            </Avatar>
            <div className="min-w-0">
              <Typography.Title level={3} className="!mb-2 !mt-0 !text-slate-800">
                {user.display_name || `${nameParts.firstName} ${nameParts.lastName}`.trim() || "-"}
              </Typography.Title>
              <div className="text-sm text-slate-500">
                รหัสพนักงาน {user.username || "-"}
              </div>
              <Space wrap size={[8, 8]} className="mt-3">
                {roleLabels.map((label) => (
                  <Tag key={label} className="!mr-0" color="red">
                    {label}
                  </Tag>
                ))}
                {user.department ? <Tag className="!mr-0">{user.department}</Tag> : null}
              </Space>
            </div>
          </div>
        </div>

        <div className="px-6 py-7 md:px-8 md:py-8">
          {editing ? (
            <Form form={form} layout="vertical" onFinish={save} requiredMark="optional">
              <div className="mb-6">{identityFields}</div>

              <Form.Item
                name="email"
                label="อีเมล"
                extra="ใช้ยืนยันบัญชีและรีเซ็ตรหัสผ่าน"
                rules={[
                  { required: true, message: "กรุณากรอกอีเมล" },
                  { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
                ]}
              >
                <Input
                  prefix={<MailOutlined />}
                  size="large"
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="telegram_id"
                label="Telegram ID"
                extra="บันทึกแล้วระบบจะผูกกับบัญชีนี้ทันที — ยังไม่ถูกเพิ่มเข้ากลุ่มจนกว่าจะกดปุ่มเข้ากลุ่ม"
                rules={[
                  {
                    validator(_, value) {
                      if (!value) return Promise.resolve();
                      if (!/^@?[a-zA-Z0-9_]{3,64}$/.test(value)) {
                        return Promise.reject(new Error("รูปแบบ Telegram ID ไม่ถูกต้อง"));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
              >
                <Input
                  prefix={<SendOutlined />}
                  size="large"
                  placeholder="@username หรือ 123456789"
                  allowClear
                />
              </Form.Item>
            </Form>
          ) : (
            <div className="space-y-6">
              {identityFields}
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <ProfileField
                    label="Telegram ID"
                    value={user.telegram_id ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <SendOutlined className="text-slate-400" />
                        {user.telegram_id}
                        <Tag
                          color="success"
                          icon={<CheckCircleOutlined />}
                          className="!mr-0"
                        >
                          บันทึกแล้ว
                        </Tag>
                      </span>
                    ) : null}
                    hint="บันทึกแล้วผูกกับบัญชี CMS ทันที"
                  />
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <ProfileField
                      label="LFB Service"
                      value={
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {user.telegram_bot_username || "@LFB_Service_bot"}
                          {user.telegram_linked ? (
                            <Tag
                              color="success"
                              icon={<CheckCircleOutlined />}
                              className="!mr-0"
                            >
                              ผูกบอทแล้ว
                            </Tag>
                          ) : (
                            <Tag color="warning" className="!mr-0">
                              ยังไม่ผูก — ทุกคนต้องผูก
                            </Tag>
                          )}
                        </span>
                      }
                      hint={
                        user.telegram_linked
                          ? "ผูกแล้ว ใช้ยืนยันตัวตนและรีเซ็ตรหัสผ่านทางแชทนี้"
                          : "กดปุ่มแล้วกด Start ใน Telegram ระบบจะผูกบัญชีให้อัตโนมัติ"
                      }
                    />
                    <Button
                      type={user.telegram_linked ? "default" : "primary"}
                      icon={<SendOutlined />}
                      onClick={openLfbService}
                      disabled={!user.telegram_bot_url}
                    >
                      {user.telegram_linked ? "เปิด LFB Service" : "ผูก LFB Service"}
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <ProfileField
                      label="กลุ่มแจ้งเตือน CMS"
                      value="LFB - CMS - Notification"
                      hint="กดปุ่มนี้เมื่อพร้อมเข้ากลุ่ม หากไม่กดจะยังไม่ถูกเพิ่มเข้ากลุ่ม"
                    />
                    <Button
                      type="primary"
                      icon={<UsergroupAddOutlined />}
                      loading={joiningGroup}
                      onClick={joinCmsGroup}
                      disabled={!user.telegram_id}
                    >
                      เข้ากลุ่ม CMS
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
