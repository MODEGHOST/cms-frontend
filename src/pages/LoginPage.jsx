import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Typography,
  message,
} from "antd";
import {
  IdcardOutlined,
  LockOutlined,
  MailOutlined,
} from "@ant-design/icons";
import { authApi } from "../services/api";
import { useSession } from "../hooks/useSession";
import { RegisterForm } from "../components/auth/RegisterForm";
import {
  PasswordStrengthInput,
  securePasswordRules,
} from "../components/auth/PasswordStrengthInput";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSession();
  const [forgotForm] = Form.useForm();
  const [searchParams, setSearchParams] = useSearchParams();
  const linkToken = searchParams.get("token");
  const resetToken = location.pathname === "/reset-password" ? linkToken : null;
  const [mode, setMode] = useState(resetToken ? "reset" : "login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    if (mode !== "register") return;
    authApi
      .companies()
      .then((data) => {
        setCompanies(Array.isArray(data) ? data : data.items || []);
      })
      .catch((err) => setError(err.message));
  }, [mode]);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    setError("");
    setSuccess("");
  };

  const onLogin = async (values) => {
    setLoading(true);
    setError("");
    try {
      await login({
        employeeCode: values.employeeCode,
        password: values.password,
      });
      navigate(location.state?.from || "/dashboard", { replace: true });
      message.success("เข้าสู่ระบบสำเร็จ");
    } catch (err) {
      setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const register = async (values) => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.register(values);
      setSuccess(data.message || "สมัครสมาชิกแล้ว กรุณารอผู้ดูแลอนุมัติ");
      setMode("login");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async ({ email }) => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await authApi.forgotPassword(email);
      setSuccess(data.message || "หากพบอีเมล ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const confirmForgotPassword = ({ email }) => {
    Modal.confirm({
      centered: true,
      title: "ยืนยันการส่งลิงก์รีเซ็ตรหัสผ่าน",
      content: (
        <div className="mt-4 space-y-3">
          <div>
            หากบัญชีผูก Telegram แล้ว ระบบจะส่งปุ่ม Reset Password ในแชท Bot
            (กรอกรหัสผ่านในแชท 2 ครั้ง) — ไม่งั้นจะส่งทางอีเมล:
          </div>
          <Alert type="info" showIcon message={email} />
        </div>
      ),
      okText: "ส่งลิงก์",
      cancelText: "ยกเลิก",
      onOk: () => forgotPassword({ email }),
    });
  };

  const resetPassword = async ({ password }) => {
    setLoading(true);
    setError("");
    try {
      const data = await authApi.resetPassword(resetToken, password);
      setSuccess(data.message || "ตั้งรหัสผ่านใหม่แล้ว กรุณาเข้าสู่ระบบ");
      setSearchParams({});
      setMode("login");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: "เข้าสู่ระบบ",
    register: "สมัครสมาชิก",
    forgot: "ลืมรหัสผ่าน",
    reset: "ตั้งรหัสผ่านใหม่",
  }[mode];

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-red-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-32 -right-28 h-96 w-96 rounded-full bg-red-600/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-red-500/10 blur-3xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />

        <div className="relative z-10 flex items-center gap-4">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white p-1.5 shadow-xl shadow-black/20">
            <img
              src="/lee-fibreboard-logo.png"
              alt="บริษัท ลี้ไฟเบอร์บอร์ด จำกัด"
              className="h-full w-full object-contain"
            />
          </div>
          <div>
            <div className="text-xl font-bold">บริษัท ลี้ไฟเบอร์บอร์ด จำกัด</div>
            <div className="mt-1 text-xs tracking-[0.12em] text-slate-400">
              LEE FIBREBOARD CO., LTD.
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-500/10 px-3.5 py-1.5 text-xs font-medium tracking-[0.14em] text-red-200">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            COMPANY INTERNAL SYSTEM
          </div>
          <p className="mb-2 text-sm font-medium tracking-[0.18em] text-red-300">
            COMPLAINT & REJECT MANAGEMENT SYSTEM
          </p>
          <h1 className="mb-5 text-5xl leading-[1.15] font-bold tracking-tight">
            Reject
            <br />
            <span className="text-red-400">&amp;</span> Quality Hub
          </h1>
          <p className="max-w-lg text-base leading-8 text-slate-300">
            ระบบสรุป Reject แทน Excel ช่วยผู้บริหารและพนักงานดูภาพรวมปัญหา บริษัท เครื่องจักร
            และแผนกได้รวดเร็ว พร้อมกรองข้อมูลแบบไม่กี่คลิก
          </p>

          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3">
            {[
              ["Dashboard", "สรุปแบบกราฟ"],
              ["Reject", "ติดตามเคลม"],
              ["Master", "ข้อมูลหลัก"],
            ].map(([heading, detail]) => (
              <div
                key={heading}
                className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur-sm"
              >
                <div className="font-semibold text-white">{heading}</div>
                <div className="mt-1 text-xs text-slate-400">{detail}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-xs text-slate-400">
          <span>สำหรับบุคลากรของบริษัทเท่านั้น</span>
          <span>SECURE INTERNAL ACCESS</span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#f3f5f9] p-6">
        <Card className="w-full max-w-md rounded-2xl shadow-sm">
          <div className="mb-6">
            <Typography.Text type="secondary">
              Complaint & Reject Management System
            </Typography.Text>
            <Typography.Title level={2} className="!mt-1 !mb-1">
              {title}
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0">
              {mode === "register"
                ? "เลือกบริษัทและส่งคำขอเข้าร่วม ผู้ดูแลระบบจะเป็นผู้อนุมัติ"
                : "ใช้รหัสพนักงานและรหัสผ่านของคุณเพื่อเข้าใช้งาน"}
            </Typography.Paragraph>
          </div>

          {error ? <Alert className="mb-4" type="error" message={error} showIcon /> : null}
          {success ? <Alert className="mb-4" type="success" message={success} showIcon /> : null}

          {mode === "login" ? (
            <Form
              name="cms-login"
              layout="vertical"
              onFinish={onLogin}
              autoComplete="on"
            >
              <Form.Item
                name="employeeCode"
                label="รหัสพนักงาน"
                rules={[{ required: true, message: "กรุณากรอกรหัสพนักงาน" }]}
              >
                <Input
                  id="login-employee-code"
                  name="employeeCode"
                  prefix={<IdcardOutlined />}
                  size="large"
                  maxLength={50}
                  placeholder="รหัสพนักงาน"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoFocus
                />
              </Form.Item>
              <Form.Item
                name="password"
                label="รหัสผ่าน"
                rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}
              >
                <Input.Password
                  id="login-password"
                  name="password"
                  prefix={<LockOutlined />}
                  size="large"
                  autoComplete="current-password"
                />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                เข้าสู่ระบบ
              </Button>
              <div className="mt-4 flex justify-between">
                <Button type="link" className="!px-0" onClick={() => changeMode("register")}>
                  สมัครสมาชิก
                </Button>
                <Button type="link" className="!px-0" onClick={() => changeMode("forgot")}>
                  ลืมรหัสผ่าน?
                </Button>
              </div>
            </Form>
          ) : null}

          {mode === "register" ? (
            <RegisterForm
              companies={companies}
              loading={loading}
              onFinish={register}
              onBackToLogin={() => changeMode("login")}
            />
          ) : null}

          {mode === "forgot" ? (
            <Form form={forgotForm} layout="vertical" onFinish={confirmForgotPassword}>
              <Form.Item
                name="email"
                label="อีเมลที่ใช้สมัคร"
                rules={[
                  { required: true, message: "กรุณากรอกอีเมล" },
                  { type: "email", message: "รูปแบบอีเมลไม่ถูกต้อง" },
                ]}
              >
                <Input prefix={<MailOutlined />} size="large" autoComplete="email" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                ส่งลิงก์รีเซ็ตรหัสผ่าน
              </Button>
              <Button type="link" block onClick={() => changeMode("login")}>
                กลับไปเข้าสู่ระบบ
              </Button>
            </Form>
          ) : null}

          {mode === "reset" ? (
            <Form layout="vertical" onFinish={resetPassword}>
              <Form.Item name="password" label="รหัสผ่านใหม่" rules={securePasswordRules}>
                <PasswordStrengthInput />
              </Form.Item>
              <Form.Item
                name="confirmPassword"
                label="ยืนยันรหัสผ่านใหม่"
                dependencies={["password"]}
                rules={[
                  { required: true, message: "กรุณายืนยันรหัสผ่าน" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      return !value || getFieldValue("password") === value
                        ? Promise.resolve()
                        : Promise.reject(new Error("รหัสผ่านไม่ตรงกัน"));
                    },
                  }),
                ]}
              >
                <Input.Password prefix={<LockOutlined />} size="large" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                บันทึกรหัสผ่านใหม่
              </Button>
            </Form>
          ) : null}
        </Card>
      </section>
    </div>
  );
}
