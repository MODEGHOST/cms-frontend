import { Button, Form, Input, Select } from "antd";
import {
  ApartmentOutlined,
  IdcardOutlined,
  MailOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { PasswordStrengthInput, securePasswordRules } from "./PasswordStrengthInput";

/**
 * Shared-auth registration form (IPMS contract).
 * Apps pass company options + submit handler; do not hide companyId.
 */
export function RegisterForm({
  companies = [],
  loading = false,
  invitation = null,
  onFinish,
  onBackToLogin,
}) {
  const options = companies.map((company) => ({
    value: company.id,
    label: company.parent_name
      ? `${company.name} · ${company.parent_name}`
      : company.name,
  }));

  return (
    <Form
      key={invitation?.email || "public-registration"}
      layout="vertical"
      onFinish={onFinish}
      initialValues={
        invitation
          ? {
              companyId: invitation.company_id,
              email: invitation.email,
            }
          : undefined
      }
    >
      <Form.Item
        name="companyId"
        label="บริษัท"
        rules={[{ required: true, message: "กรุณาเลือกบริษัท" }]}
        className="!mb-3"
      >
        <Select
          showSearch
          size="large"
          placeholder="เลือกบริษัทที่คุณทำงาน"
          optionFilterProp="label"
          options={options}
          suffixIcon={<ApartmentOutlined />}
          disabled={Boolean(invitation)}
        />
      </Form.Item>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Form.Item
          name="employeeCode"
          label="รหัสพนักงาน"
          normalize={(value) => String(value || "").replace(/\D/g, "").slice(0, 8)}
          rules={[
            { required: true, message: "กรุณากรอกรหัสพนักงาน" },
            { pattern: /^\d{8}$/, message: "รหัสพนักงานต้องเป็นตัวเลข 8 หลัก" },
          ]}
          className="!mb-3"
          extra="ใช้เข้าสู่ระบบ"
        >
          <Input
            prefix={<IdcardOutlined />}
            size="large"
            maxLength={8}
            inputMode="numeric"
            placeholder="ตัวเลข 8 หลัก"
          />
        </Form.Item>
        <Form.Item
          name="telegramId"
          label="Telegram ID"
          rules={[
            {
              validator(_, value) {
                if (!value) return Promise.resolve();
                if (!/^@?[a-zA-Z0-9_]{3,64}$/.test(value)) {
                  return Promise.reject(new Error("รูปแบบไม่ถูกต้อง"));
                }
                return Promise.resolve();
              },
            },
          ]}
          className="!mb-3"
          extra="ไม่บังคับ"
        >
          <Input size="large" placeholder="@username หรือ ID" maxLength={64} />
        </Form.Item>
      </div>

      <div className="grid grid-cols-1 gap-x-3 sm:grid-cols-2">
        <Form.Item
          name="firstName"
          label="ชื่อ"
          rules={[{ required: true, message: "กรุณากรอกชื่อ" }]}
          className="!mb-3"
        >
          <Input prefix={<UserOutlined />} size="large" maxLength={120} />
        </Form.Item>
        <Form.Item
          name="lastName"
          label="นามสกุล"
          rules={[{ required: true, message: "กรุณากรอกนามสกุล" }]}
          className="!mb-3"
        >
          <Input size="large" maxLength={120} />
        </Form.Item>
      </div>

      <Form.Item
        name="email"
        label="อีเมล"
        rules={[
          { required: true, message: "กรุณากรอกอีเมล" },
          { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
        ]}
        className="!mb-3"
        extra="ยืนยันบัญชี / รีเซ็ตรหัสผ่าน"
      >
        <Input
          prefix={<MailOutlined />}
          size="large"
          autoComplete="email"
          disabled={Boolean(invitation)}
        />
      </Form.Item>

      <Form.Item
        name="password"
        label="ตั้งรหัสผ่าน"
        rules={securePasswordRules}
        className="!mb-3"
      >
        <PasswordStrengthInput />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={loading}>
        ส่งคำขอสมัครสมาชิก
      </Button>
      <Button type="link" block onClick={onBackToLogin}>
        กลับไปเข้าสู่ระบบ
      </Button>
    </Form>
  );
}
