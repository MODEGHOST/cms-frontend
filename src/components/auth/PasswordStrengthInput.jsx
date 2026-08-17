import { Input, Progress } from "antd";
import { LockOutlined } from "@ant-design/icons";
import {
  getPasswordStatus,
  passwordValidationError,
} from "../../utils/passwordPolicy";

/** Shared-auth shaped password field — keep in sync with IPMS. */
export function PasswordStrengthInput({ value = "", onChange, ...inputProps }) {
  const { checks, percent } = getPasswordStatus(value);
  const color = percent < 50 ? "#ef4444" : percent < 80 ? "#f59e0b" : "#16a34a";
  const label = percent < 50 ? "ควรปรับปรุง" : percent < 80 ? "ปานกลาง" : "แข็งแรง";

  return (
    <div>
      <Input.Password
        {...inputProps}
        value={value}
        onChange={onChange}
        prefix={<LockOutlined />}
        size="large"
        autoComplete="new-password"
      />
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">ความปลอดภัยของรหัสผ่าน</span>
          <span style={{ color }} className="font-semibold">
            {percent}% · {label}
          </span>
        </div>
        <Progress
          percent={percent}
          showInfo={false}
          strokeColor={color}
          trailColor="#e2e8f0"
          size="small"
        />
        <div className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {checks.map((check) => (
            <span
              key={check.key}
              className={check.met ? "text-green-700" : value ? "text-red-600" : "text-slate-500"}
            >
              {check.met ? "✓" : "○"} {check.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export const securePasswordRules = [
  { required: true, message: "กรุณาตั้งรหัสผ่าน" },
  {
    validator(_, value) {
      if (!value) return Promise.resolve();
      const error = passwordValidationError(value);
      return error ? Promise.reject(new Error(error)) : Promise.resolve();
    },
  },
];
