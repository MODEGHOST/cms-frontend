import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { RejectsPage } from "../pages/RejectsPage";
import { MastersPage } from "../pages/MastersPage";
import { useSession } from "../hooks/useSession";

function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useSession();
  if (loading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return children;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicOnly>
            <LoginPage />
          </PublicOnly>
        }
      />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/rejects" element={<RejectsPage />} />
          <Route path="/masters" element={<MastersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
