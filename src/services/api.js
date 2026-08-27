import axios from "axios";

/** PM2 on company server (IPMS uses 4000). Override: VITE_API_URL or VITE_API_PORT. */
const PRODUCTION_API_PORT = import.meta.env.VITE_API_PORT || "4001";
const PRODUCTION_API_PATH = "/lfb_cms/backend";

function resolveApiOrigin() {
  if (import.meta.env.VITE_API_URL) {
    return String(import.meta.env.VITE_API_URL).replace(/\/$/, "");
  }
  if (!import.meta.env.PROD) {
    return "";
  }
  // Production: call PM2 directly on same host — no IIS proxy / Convert Application needed.
  if (typeof window !== "undefined" && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${PRODUCTION_API_PORT}${PRODUCTION_API_PATH}`;
  }
  return PRODUCTION_API_PATH;
}

const apiOrigin = resolveApiOrigin();

const api = axios.create({
  baseURL: apiOrigin,
  withCredentials: true,
});

const authFailureListeners = new Set();
const PUBLIC_AUTH_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
];

export function onAuthFailure(listener) {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
}

function isPublicAuthRequest(url = "") {
  return PUBLIC_AUTH_PATHS.some((path) => String(url).includes(path));
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = error?.response?.data?.message || error.message || "Request failed";
    if (status === 401 && !isPublicAuthRequest(error?.config?.url)) {
      authFailureListeners.forEach((listener) => listener());
    }
    return Promise.reject(Object.assign(new Error(message), {
      status,
      data: error?.response?.data,
    }));
  },
);

export const healthApi = {
  check: () => api.get("/api/health").then((res) => res.data),
};

export const authApi = {
  me: () => api.get("/api/auth/me").then((res) => res.data),
  updateProfile: (payload) =>
    api.patch("/api/auth/me", payload).then((res) => res.data),
  telegramGroup: () =>
    api.get("/api/auth/telegram-group").then((res) => res.data),
  login: (payload) => api.post("/api/auth/login", payload).then((res) => res.data),
  logout: () => api.post("/api/auth/logout").then((res) => res.data),
  companies: () => api.get("/api/companies/public").then((res) => res.data),
  register: (payload) => api.post("/api/auth/register", payload).then((res) => res.data),
  forgotPassword: (email) =>
    api.post("/api/auth/forgot-password", { email }).then((res) => res.data),
  resetPassword: (token, password) =>
    api.post("/api/auth/reset-password", { token, password }).then((res) => res.data),
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
  getSummaryTable: (params) =>
    api.get("/api/dashboard/reject/summary-table", { params }).then((res) => res.data),
  getKpiDetail: (params) =>
    api.get("/api/dashboard/reject/kpi-detail", { params }).then((res) => res.data),
  getProblemDetail: (params) =>
    api.get("/api/dashboard/reject/problem-detail", { params }).then((res) => res.data),
  getDepartmentDetail: (params) =>
    api.get("/api/dashboard/reject/department-detail", { params }).then((res) => res.data),
  getOrderRate: (params) =>
    api.get("/api/dashboard/reject/order-rate", { params }).then((res) => res.data),
  getDeptTargetRate: (params) =>
    api.get("/api/dashboard/reject/dept-target-rate", { params }).then((res) => res.data),
  updateDeptTargets: (payload) =>
    api
      .put("/api/dashboard/reject/dept-target-rate/targets", payload)
      .then((res) => res.data),
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
  getOrderRate: (params) =>
    api.get("/api/dashboard/complaint/order-rate", { params }).then((res) => res.data),
  getDeptTargetRate: (params) =>
    api
      .get("/api/dashboard/complaint/dept-target-rate", { params })
      .then((res) => res.data),
  updateDeptTargets: (payload) =>
    api
      .put("/api/dashboard/complaint/dept-target-rate/targets", payload)
      .then((res) => res.data),
};

export const rejectApi = {
  list: (params) => api.get("/api/rejects", { params }).then((res) => res.data),
  searchByPdr: (pdrNo) =>
    api.get("/api/rejects", { params: { pdr_no: pdrNo } }).then((res) => res.data),
  /** INSERT Reject จากข้อมูลฟอร์มหลัง Search — ไม่เรียก ERP ซ้ำ */
  createFromDraft: (payload) =>
    api.post("/api/rejects/from-draft", payload).then((res) => res.data),
  /** INSERT โดย GET ERP ใหม่ (fallback) */
  fromErp: (pdrNo) =>
    api.post("/api/rejects/from-erp", { pdr_no: pdrNo }).then((res) => res.data),
  /** เติมช่อง ERP ที่ว่างบน Reject ที่มีอยู่ (GET ERP อย่างเดียว) — ตอนเปิดฟอร์ม */
  enrichFromErp: (id) =>
    api.post(`/api/rejects/${id}/enrich-from-erp`).then((res) => res.data),
  formOptions: () => api.get("/api/rejects/form-options").then((res) => res.data),
  update: (id, payload) =>
    api.patch(`/api/rejects/${id}`, payload).then((res) => res.data),
  returnToCs: (id, reason) =>
    api
      .post(`/api/rejects/${id}/return-to-cs`, { reason })
      .then((res) => res.data),
  downloadMemoPdf: async (id, payload) => downloadRejectPdf(id, "memo.pdf", payload),
  downloadTagPdf: async (id, payload) => downloadRejectPdf(id, "tag.pdf", payload),
};

async function downloadRejectPdf(id, pathSuffix, payload) {
  try {
    const response = await api.post(`/api/rejects/${id}/${pathSuffix}`, payload, {
      responseType: "blob",
    });
    const disposition = response.headers?.["content-disposition"] || "";
    const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
    const filename = utfMatch
      ? decodeURIComponent(utfMatch[1])
      : plainMatch
        ? plainMatch[1]
        : pathSuffix;
    const blobUrl = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(blobUrl);
    return { filename };
  } catch (error) {
    const blob = error?.data instanceof Blob ? error.data : error?.response?.data;
    if (blob instanceof Blob) {
      try {
        const payloadJson = JSON.parse(await blob.text());
        throw Object.assign(new Error(payloadJson.message || "ดาวน์โหลด PDF ไม่สำเร็จ"), {
          status: error.status || error?.response?.status,
        });
      } catch (parseError) {
        if (parseError?.message && !String(parseError.message).includes("JSON")) {
          throw parseError;
        }
      }
    }
    throw error;
  }
}

/** Beta_api_erp ผ่าน CMS backend — ปิดได้ด้วย ERP_API_ENABLED=0 */
export const erpApi = {
  getPdr: (pdrNo) =>
    api
      .get("/api/erp/pdr", { params: { pdr_no: pdrNo } })
      .then((res) => res.data)
      .catch((error) => ({
        enabled: false,
        ok: false,
        data: [],
        error: error?.message || "ERP unavailable",
      })),
};

export const complaintApi = {
  inbox: (params) =>
    api.get("/api/complaints/inbox", { params }).then((res) => res.data),
  inboxCount: () =>
    api.get("/api/complaints/inbox/count").then((res) => res.data),
  searchByPdr: (pdrNo) =>
    api.get("/api/complaints", { params: { pdr_no: pdrNo } }).then((res) => res.data),
  /** INSERT Complaint จากข้อมูลฟอร์มหลัง Search — ไม่เรียก ERP ซ้ำ */
  createFromDraft: (payload) =>
    api.post("/api/complaints/from-draft", payload).then((res) => res.data),
  /** INSERT โดย GET ERP ใหม่ (fallback) */
  fromErp: (pdrNo) =>
    api.post("/api/complaints/from-erp", { pdr_no: pdrNo }).then((res) => res.data),
  formOptions: () => api.get("/api/complaints/form-options").then((res) => res.data),
  planSigners: () => api.get("/api/plan-signers").then((res) => res.data),
  fetchPlanSignerSignatureBlob: async (id) => {
    const res = await api.get(`/api/plan-signers/${id}/signature`, {
      responseType: "blob",
    });
    const blob = res.data;
    const type = String(blob?.type || "");
    if (type.includes("json") || type.includes("text/html")) {
      throw new Error("ไม่พบลายเซ็น");
    }
    return blob;
  },
  nextDocumentNo: () =>
    api.get("/api/complaints/next-document-no").then((res) => res.data),
  downloadActionPlanPdf: async (id) => {
    try {
      const response = await api.get(`/api/complaints/${id}/action-plan.pdf`, {
        responseType: "blob",
      });
      const disposition = response.headers?.["content-disposition"] || "";
      const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
      const filename = utfMatch
        ? decodeURIComponent(utfMatch[1])
        : plainMatch
          ? plainMatch[1]
          : `action-plan-${id}.pdf`;
      const blobUrl = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      return { filename };
    } catch (error) {
      const blob = error?.data instanceof Blob ? error.data : error?.response?.data;
      if (blob instanceof Blob) {
        try {
          const payload = JSON.parse(await blob.text());
          throw Object.assign(new Error(payload.message || "ดาวน์โหลด PDF ไม่สำเร็จ"), {
            status: error.status || error?.response?.status,
          });
        } catch (parseError) {
          if (parseError?.message && !String(parseError.message).includes("JSON")) {
            throw parseError;
          }
        }
      }
      throw error;
    }
  },
  update: (id, payload) =>
    api.patch(`/api/complaints/${id}`, payload).then((res) => res.data),
  submitCs: (id, formData) =>
    api.post(`/api/complaints/${id}/cs-submit`, formData).then((res) => res.data),
  submitDepartment: (id, formData) =>
    api.post(`/api/complaints/${id}/department-submit`, formData).then((res) => res.data),
  saveQaConfirm: (id, formData) =>
    api.post(`/api/complaints/${id}/qa-confirm-save`, formData).then((res) => res.data),
  submitQa: (id, formData) =>
    api.post(`/api/complaints/${id}/qa-submit`, formData).then((res) => res.data),
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
  listDepartmentWorkPermissions: () =>
    api.get("/api/system/department-work-permissions").then((res) => res.data),
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
