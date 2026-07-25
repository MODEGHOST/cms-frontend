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
  getRejectDayDetail: (params) =>
    api.get("/api/dashboard/reject/day-detail", { params }).then((res) => res.data),
  getKpiDetail: (params) =>
    api.get("/api/dashboard/reject/kpi-detail", { params }).then((res) => res.data),
  getProblemDetail: (params) =>
    api.get("/api/dashboard/reject/problem-detail", { params }).then((res) => res.data),
  getDepartmentDetail: (params) =>
    api.get("/api/dashboard/reject/department-detail", { params }).then((res) => res.data),
};

export const rejectApi = {
  list: (params) => api.get("/api/rejects", { params }).then((res) => res.data),
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

export default api;
