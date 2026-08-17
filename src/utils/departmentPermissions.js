/**
 * Keep in sync with cms-backend/src/utils/department-permissions.js
 */
import {
  CANONICAL_DEPARTMENTS,
  canonicalizeDepartmentName,
  normalizeDepartmentKey,
} from "./departmentMap";

export const STAFF_BASE_PERMISSIONS = [
  "rejects.read",
  "complaints.read",
  "masters.read",
  "dashboard.read",
  "activity.read",
];

const CS_DEPARTMENTS = new Set(["MKT", "SALE"]);

export const WORKFLOW_PERMISSION_LABELS = {
  "complaints.cs": "งาน Complaint ขั้น CS",
  "complaints.qa": "งาน Complaint ขั้น QA",
  "complaints.department": "รับเรื่อง/กรอกตามหน่วยงานที่รับผิดชอบ",
  "rejects.update": "แก้ไข Reject (QC)",
};

export function permissionsForDepartment(department) {
  const canonical = canonicalizeDepartmentName(department);
  if (!canonical) return [];

  const key = normalizeDepartmentKey(canonical);
  const hit = CANONICAL_DEPARTMENTS.find(
    (name) => normalizeDepartmentKey(name) === key,
  );
  const name = hit || canonical;

  if (CS_DEPARTMENTS.has(name)) return ["complaints.cs"];
  if (name === "QA") return ["complaints.qa"];
  if (name === "QC") return ["rejects.update"];
  if (hit) return ["complaints.department"];
  return [];
}

/** แผนกที่รับเรื่อง/กรอกขั้นหน่วยงานได้ (เอกสาร P) — ไม่รวม MKT/SALE/QA/QC */
export function canHandleDepartmentStep(department) {
  return permissionsForDepartment(department).includes("complaints.department");
}

/**
 * Merge role permissions with department-derived workflow permissions.
 * Keep in sync with cms-backend mergeStaffPermissions.
 */
export function mergeStaffPermissions(roleNames, rolePermissions, department) {
  const roles = roleNames || [];
  const base = [...(rolePermissions || [])];
  if (!roles.includes("staff")) {
    return [...new Set(base)].sort();
  }
  const extra = permissionsForDepartment(department);
  return [...new Set([...base, ...extra])].sort();
}

export function listDepartmentWorkMatrix() {
  return CANONICAL_DEPARTMENTS.map((department) => {
    const permissions = permissionsForDepartment(department);
    return {
      department,
      permissions,
      labels: permissions.map(
        (code) => WORKFLOW_PERMISSION_LABELS[code] || code,
      ),
      work_summary:
        permissions.length === 0
          ? "อ่านอย่างเดียว (ยังไม่มีสิทธิ์งาน)"
          : permissions
              .map((code) => WORKFLOW_PERMISSION_LABELS[code] || code)
              .join(" · "),
    };
  });
}
