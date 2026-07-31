import { Navigate, Route, Routes } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";
import { AppLayout } from "../layouts/AppLayout";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { RejectsPage } from "../pages/RejectsPage";
import { RejectFormPage } from "../pages/RejectFormPage";
import { ComplaintFormPage } from "../pages/ComplaintFormPage";
import { ActivityLogsPage } from "../pages/ActivityLogsPage";
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
          <Route path="/reject-form" element={<RejectFormPage />} />
          <Route path="/complaint-form" element={<ComplaintFormPage />} />
          <Route path="/activity-logs" element={<ActivityLogsPage />} />
          <Route path="/masters" element={<MastersPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
