import { useState } from "react";
import { Alert, Button, Card, Form, Input, Typography } from "antd";
import { LockOutlined, UserOutlined } from "@ant-design/icons";
import { useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useSession();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
            COMPLAINT MANAGEMENT SYSTEM
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
              Complaint Management System
            </Typography.Text>
            <Typography.Title level={2} className="!mt-1 !mb-1">
              เข้าสู่ระบบ
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="!mb-0">
              ใช้ชื่อผู้ใช้และรหัสผ่านของคุณเพื่อเข้าใช้งาน
            </Typography.Paragraph>
          </div>

          {error ? <Alert className="mb-4" type="error" message={error} showIcon /> : null}

          <Form
            layout="vertical"
            onFinish={async (values) => {
              setLoading(true);
              setError("");
              try {
                await login(values);
                navigate(location.state?.from || "/dashboard", { replace: true });
              } catch (err) {
                setError(err.message || "เข้าสู่ระบบไม่สำเร็จ");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item
              name="username"
              label="ชื่อผู้ใช้"
              rules={[{ required: true, message: "กรุณากรอกชื่อผู้ใช้" }]}
            >
              <Input prefix={<UserOutlined />} size="large" autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item
              name="password"
              label="รหัสผ่าน"
              rules={[{ required: true, message: "กรุณากรอกรหัสผ่าน" }]}
            >
              <Input.Password prefix={<LockOutlined />} size="large" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              เข้าสู่ระบบ
            </Button>
          </Form>
        </Card>
      </section>
    </div>
  );
}
