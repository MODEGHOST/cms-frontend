const THAI_CHARACTER = /[\u0E00-\u0E7F]/;
const LOWERCASE_CHARACTER = /[a-z]/;
const UPPERCASE_CHARACTER = /[A-Z]/;
const NUMBER_CHARACTER = /[0-9]/;
const SPECIAL_CHARACTER = /[^A-Za-z0-9\s\u0E00-\u0E7F]/;

export function getPasswordStatus(value) {
  const password = String(value || "");
  const hasThai = THAI_CHARACTER.test(password);
  const checks = [
    {
      key: "length",
      label: "อย่างน้อย 8 ตัวอักษร",
      met: password.length >= 8,
      required: true,
    },
    {
      key: "lowercase",
      label: "ตัวพิมพ์เล็ก (a-z)",
      met: LOWERCASE_CHARACTER.test(password),
      required: true,
    },
    {
      key: "uppercase",
      label: "ตัวพิมพ์ใหญ่ (A-Z)",
      met: UPPERCASE_CHARACTER.test(password),
      required: true,
    },
    {
      key: "special",
      label: "อักขระพิเศษ เช่น !@#$",
      met: SPECIAL_CHARACTER.test(password),
      required: true,
    },
    {
      key: "thai",
      label: "ไม่มีอักษรภาษาไทย",
      met: password.length > 0 && !hasThai,
      required: true,
    },
    {
      key: "number",
      label: "มีตัวเลข (แนะนำ)",
      met: NUMBER_CHARACTER.test(password),
      required: false,
    },
  ];

  let percent =
    [
      password.length >= 8,
      LOWERCASE_CHARACTER.test(password),
      UPPERCASE_CHARACTER.test(password),
      SPECIAL_CHARACTER.test(password),
      NUMBER_CHARACTER.test(password),
    ].filter(Boolean).length * 20;

  if (hasThai) percent = Math.min(percent, 20);

  return {
    checks,
    percent,
    valid: checks.filter((check) => check.required).every((check) => check.met),
  };
}

export function passwordValidationError(value) {
  const status = getPasswordStatus(value);
  const failedCheck = status.checks.find((check) => check.required && !check.met);
  if (!failedCheck) return "";

  return {
    length: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
    lowercase: "รหัสผ่านต้องมีตัวพิมพ์เล็กอย่างน้อย 1 ตัว",
    uppercase: "รหัสผ่านต้องมีตัวพิมพ์ใหญ่อย่างน้อย 1 ตัว",
    special: "รหัสผ่านต้องมีอักขระพิเศษอย่างน้อย 1 ตัว",
    thai: "รหัสผ่านต้องไม่มีอักษรภาษาไทย",
  }[failedCheck.key];
}
