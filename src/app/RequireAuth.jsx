import { useEffect } from "react";
import { Spin } from "antd";
import { Outlet } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { redirectToPortal } from "../utils/portal";

export function RequireAuth() {
  const { isAuthenticated, loading } = useSession();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      redirectToPortal();
    }
  }, [loading, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  return <Outlet />;
}
