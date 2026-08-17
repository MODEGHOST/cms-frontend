import { Tabs } from "antd";
import { Navigate } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { MasterPanel } from "../components/masters/MasterPanel";
import { useSession } from "../hooks/useSession";
import { canAccessMasters } from "../utils/authz";

const TABS = [
  { key: "companies", label: "บริษัท", hasCompany: false },
  { key: "customer-aliases", label: "ชื่อเล่น", hasCompany: true },
  { key: "departments", label: "แผนก", hasCompany: false },
  { key: "machines", label: "เครื่องจักร", hasCompany: false },
  { key: "problems", label: "ปัญหา", hasCompany: false },
  { key: "shifts", label: "กะ", hasCompany: false },
];

export function MastersPage() {
  const { user } = useSession();
  if (!canAccessMasters(user)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div>
      <PageHeader
        title="Master Data"
        description="ค้นหา / แบ่งหน้า ทำที่ API — หน้าบ้านแสดงผลอย่างเดียว"
      />
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <Tabs
          destroyOnHidden
          items={TABS.map((tab) => ({
            key: tab.key,
            label: tab.label,
            children: <MasterPanel masterKey={tab.key} hasCompany={tab.hasCompany} />,
          }))}
        />
      </div>
    </div>
  );
}
