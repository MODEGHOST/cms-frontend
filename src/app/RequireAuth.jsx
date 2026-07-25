import { Spin } from "antd";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useSession } from "../hooks/useSession";

export function RequireAuth() {
  const { isAuthenticated, loading } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
