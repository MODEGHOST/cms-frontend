/** Frontend CMS RBAC helpers (mirrors backend authz). */

export function hasPermission(user, permission) {
  if (!user || !permission) return false;
  const list = user.permissions;
  if (!Array.isArray(list) || !list.length) return false;
  return list.includes(permission);
}

export function hasRole(user, roleName) {
  if (!user || !roleName) return false;
  if (Array.isArray(user.roles) && user.roles.includes(roleName)) return true;
  return user.role === roleName;
}

export function isCmsAdmin(user) {
  return (
    hasRole(user, "developer") ||
    hasRole(user, "admin") ||
    hasPermission(user, "complaints.manage_all")
  );
}

export function canManageSystem(user) {
  return (
    isCmsAdmin(user) ||
    hasPermission(user, "system.manage") ||
    hasPermission(user, "members.manage")
  );
}

export function canCsWork(user) {
  return isCmsAdmin(user) || hasPermission(user, "complaints.cs");
}

export function canQaWork(user) {
  return isCmsAdmin(user) || hasPermission(user, "complaints.qa");
}

export function canDepartmentWork(user) {
  return isCmsAdmin(user) || hasPermission(user, "complaints.department");
}

export function canUpdateRejects(user) {
  return isCmsAdmin(user) || hasPermission(user, "rejects.update");
}

export function canManageMasters(user) {
  return isCmsAdmin(user) || hasPermission(user, "masters.manage");
}
