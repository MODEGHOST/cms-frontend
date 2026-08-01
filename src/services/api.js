import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error?.response?.data?.message || error.message || "Request failed";
    return Promise.reject(Object.assign(new Error(message), {
      status: error?.response?.status,
      data: error?.response?.data,
    }));
  },
);

export const healthApi = {
  check: () => api.get("/api/health").then((res) => res.data),
};

export const authApi = {
  me: () => api.get("/api/auth/me").then((res) => res.data),
  login: (payload) => api.post("/api/auth/login", payload).then((res) => res.data),
  logout: () => api.post("/api/auth/logout").then((res) => res.data),
};

export const dashboardApi = {
  getReject: (params) =>
    api.get("/api/dashboard/reject", { params }).then((res) => res.data),
  getTrend: (params) =>
    api.get("/api/dashboard/reject/trend", { params }).then((res) => res.data),
  getFilterOptions: () =>
    api.get("/api/dashboard/reject/filter-options").then((res) => res.data),
  getRejectDayDetail: (params) =>
    api.get("/api/dashboard/reject/day-detail", { params }).then((res) => res.data),
  getTopComparison: (params) =>
    api.get("/api/dashboard/reject/top-comparison", { params }).then((res) => res.data),
  getMachineComparison: (params) =>
    api.get("/api/dashboard/reject/machine-comparison", { params }).then((res) => res.data),
  getKpiDetail: (params) =>
    api.get("/api/dashboard/reject/kpi-detail", { params }).then((res) => res.data),
  getProblemDetail: (params) =>
    api.get("/api/dashboard/reject/problem-detail", { params }).then((res) => res.data),
  getDepartmentDetail: (params) =>
    api.get("/api/dashboard/reject/department-detail", { params }).then((res) => res.data),
};

export const complaintDashboardApi = {
  getSummary: (params) =>
    api.get("/api/dashboard/complaint", { params }).then((res) => res.data),
  getTrend: (params) =>
    api.get("/api/dashboard/complaint/trend", { params }).then((res) => res.data),
  getFilterOptions: () =>
    api.get("/api/dashboard/complaint/filter-options").then((res) => res.data),
  getSummaryTable: (params) =>
    api.get("/api/dashboard/complaint/summary-table", { params }).then((res) => res.data),
  getKpiDetail: (params) =>
    api.get("/api/dashboard/complaint/kpi-detail", { params }).then((res) => res.data),
  getEntityDetail: (params) =>
    api.get("/api/dashboard/complaint/entity-detail", { params }).then((res) => res.data),
};

export const rejectApi = {
  list: (params) => api.get("/api/rejects", { params }).then((res) => res.data),
  searchByPdr: (pdrNo) =>
    api.get("/api/rejects", { params: { pdr_no: pdrNo } }).then((res) => res.data),
  formOptions: () => api.get("/api/rejects/form-options").then((res) => res.data),
  update: (id, payload) =>
    api.patch(`/api/rejects/${id}`, payload).then((res) => res.data),
};

export const complaintApi = {
  searchByPdr: (pdrNo) =>
    api.get("/api/complaints", { params: { pdr_no: pdrNo } }).then((res) => res.data),
  formOptions: () => api.get("/api/complaints/form-options").then((res) => res.data),
  nextDocumentNo: () =>
    api.get("/api/complaints/next-document-no").then((res) => res.data),
  update: (id, payload) =>
    api.patch(`/api/complaints/${id}`, payload).then((res) => res.data),
  submitCs: (id, formData) =>
    api.post(`/api/complaints/${id}/cs-submit`, formData).then((res) => res.data),
  submitDepartment: (id, formData) =>
    api.post(`/api/complaints/${id}/department-submit`, formData).then((res) => res.data),
  accept: (id) =>
    api.patch(`/api/complaints/${id}`, { action: "accept" }).then((res) => res.data),
  ensureDocFields: (id) =>
    api
      .patch(`/api/complaints/${id}`, { action: "ensure_doc_fields" })
      .then((res) => res.data),
};

export const activityLogApi = {
  list: (params) =>
    api.get("/api/activity-logs", { params }).then((res) => res.data),
};

/** All filtering/search/pagination params are sent to backend as-is. */
export const masterApi = {
  list: (key, params) =>
    api.get(`/api/masters/${key}`, { params }).then((res) => res.data),
  create: (key, payload) =>
    api.post(`/api/masters/${key}`, payload).then((res) => res.data),
  update: (key, id, payload) =>
    api.patch(`/api/masters/${key}/${id}`, payload).then((res) => res.data),
};

export const systemApi = {
  overview: () => api.get("/api/system/overview").then((res) => res.data),
  listRoles: () => api.get("/api/system/roles").then((res) => res.data),
  listPermissions: () =>
    api.get("/api/system/permissions").then((res) => res.data),
  createRole: (payload) =>
    api.post("/api/system/roles", payload).then((res) => res.data),
  updateRolePermissions: (roleId, permissionIds) =>
    api
      .put(`/api/system/roles/${roleId}/permissions`, { permissionIds })
      .then((res) => res.data),
  deleteRole: (roleId) =>
    api.delete(`/api/system/roles/${roleId}`).then((res) => res.data),
  listMembers: (params) =>
    api.get("/api/system/members", { params }).then((res) => res.data),
  listCenterUsers: (params) =>
    api.get("/api/system/center-users", { params }).then((res) => res.data),
  createMember: (payload) =>
    api.post("/api/system/members", payload).then((res) => res.data),
  updateMember: (userId, payload) =>
    api.patch(`/api/system/members/${userId}`, payload).then((res) => res.data),
  revokeMember: (userId) =>
    api.delete(`/api/system/members/${userId}`).then((res) => res.data),
};

export default api;
