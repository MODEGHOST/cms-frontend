import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Avatar, Button, Drawer, Dropdown, Menu, Tooltip } from "antd";
import {
  DashboardOutlined,
  DatabaseOutlined,
  FormOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";
import { complaintApi } from "../services/api";
import { canAccessMasters, isBuiltInAdmin } from "../utils/authz";
import { redirectToPortal } from "../utils/portal";

function buildNavGroups(user, complaintInboxCount = 0) {
  const systemChildren = [
    { key: "/activity-logs", icon: <HistoryOutlined />, label: "Activity Log" },
  ];
  if (canAccessMasters(user)) {
    systemChildren.push({
      key: "/masters",
      icon: <DatabaseOutlined />,
      label: "Master Data",
    });
  }
  if (isBuiltInAdmin(user)) {
    systemChildren.push({
      key: "/system",
      icon: <SettingOutlined />,
      label: "สมาชิกและสิทธิ์",
    });
  }

  const complaintListLabel =
    complaintInboxCount > 0
      ? `รายการ Complaint (${complaintInboxCount})`
      : "รายการ Complaint";

  return [
    {
      key: "reject",
      label: "Reject",
      children: [
        { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard Reject" },
        { key: "/rejects", icon: <FileSearchOutlined />, label: "รายการ Reject" },
        { key: "/reject-form", icon: <FormOutlined />, label: "ฟอร์ม Reject" },
      ],
    },
    {
      key: "complaint",
      label: "Complaint",
      children: [
        {
          key: "/complaint-dashboard",
          icon: <DashboardOutlined />,
          label: "Dashboard Complaint",
        },
        {
          key: "/complaints",
          icon: <FileSearchOutlined />,
          label: complaintListLabel,
          pageTitle: "รายการ Complaint",
        },
        {
          key: "/complaint-form",
          icon: <FormOutlined />,
          label: "ฟอร์ม Complaint",
        },
      ],
    },
    {
      key: "system",
      label: "ระบบ",
      children: systemChildren,
    },
  ];
}

const SIDEBAR_EXPANDED = 248;
const SIDEBAR_COLLAPSED = 76;
const SIDEBAR_STORAGE_KEY = "cms.sidebar.collapsed";

function SidebarContent({
  selectedKey,
  onNavigate,
  onLogout,
  user,
  collapsed = false,
  onToggleCollapse,
  navGroups,
}) {
  const displayName = user?.display_name || user?.username || "?";
  return (
    <div className="app-sidebar flex h-full flex-col bg-slate-950 text-white">
      <div
        className={`flex items-center border-b border-white/10 py-4 ${
          collapsed ? "justify-center px-2" : "gap-3 px-5"
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white p-0.5 shadow-sm">
          <img
            src="/lee-fibreboard-logo.png"
            alt="Lee Fibreboard"
            className="h-full w-full object-contain"
          />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <div className="text-[13px] leading-4 font-semibold text-white">
              Complaint & Reject
              <br />
              Management System
            </div>
            <div className="mt-1 text-[10px] tracking-[0.08em] text-red-300">
              LEE FIBREBOARD
            </div>
          </div>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        <Menu
          theme="dark"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          className="border-none !bg-transparent"
          style={{ borderInlineEnd: "none" }}
          items={(navGroups || []).map((group) => ({
            type: "group",
            key: group.key,
            label: group.label,
            children: group.children.map((item) => ({
              key: item.key,
              icon: item.icon,
              label: item.label,
              title: item.disabled ? `${item.label} (เร็วๆ นี้)` : item.label,
              disabled: Boolean(item.disabled),
              onClick: item.disabled ? undefined : () => onNavigate(item.key),
            })),
          }))}
        />
      </div>

      <div className={`border-t border-white/10 ${collapsed ? "p-2" : "p-4"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip title={displayName} placement="right">
              <Avatar className="bg-red-100 text-red-700">
                {displayName.slice(0, 1)}
              </Avatar>
            </Tooltip>
            <Tooltip title="ออกจากระบบ" placement="right">
              <Button
                type="text"
                className="!text-slate-400 hover:!bg-white/10 hover:!text-white"
                icon={<LogoutOutlined />}
                onClick={onLogout}
              />
            </Tooltip>
            {onToggleCollapse ? (
              <Tooltip title="ขยายเมนู" placement="right">
                <Button
                  type="text"
                  className="!text-slate-400 hover:!bg-white/10 hover:!text-white"
                  icon={<MenuUnfoldOutlined />}
                  onClick={onToggleCollapse}
                />
              </Tooltip>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Avatar className="bg-red-100 text-red-700">
                {displayName.slice(0, 1)}
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-100">
                  {displayName}
                </div>
                <div className="text-xs text-slate-400">
                  {user?.department
                    ? `แผนก ${user.department} · ${(user?.roles || [user?.role]).filter(Boolean).join(", ") || "-"}`
                    : (user?.roles || [user?.role]).filter(Boolean).join(", ") || "-"}
                </div>
              </div>
              <Button
                type="text"
                className="!text-slate-400 hover:!bg-white/10 hover:!text-white"
                icon={<LogoutOutlined />}
                onClick={onLogout}
                title="ออกจากระบบ"
              />
            </div>
            {onToggleCollapse ? (
              <Button
                type="text"
                block
                className="!justify-start !text-slate-400 hover:!bg-white/10 hover:!text-white"
                icon={<MenuFoldOutlined />}
                onClick={onToggleCollapse}
              >
                ย่อเมนู
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [complaintInboxCount, setComplaintInboxCount] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const refreshComplaintInboxCount = useCallback(async () => {
    try {
      const result = await complaintApi.inboxCount();
      setComplaintInboxCount(Number(result?.total || 0));
    } catch {
      // keep last known count if refresh fails
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  useEffect(() => {
    refreshComplaintInboxCount();
    // รีเฟรชเบาๆ: ทุก 3 นาที + ตอนกลับมาโฟกัสหน้าต่าง (ไม่ยิงทุกครั้งที่เปลี่ยนหน้า)
    const timer = window.setInterval(refreshComplaintInboxCount, 180_000);
    const onFocus = () => refreshComplaintInboxCount();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshComplaintInboxCount]);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const navGroups = useMemo(
    () => buildNavGroups(user, complaintInboxCount),
    [user, complaintInboxCount],
  );
  const navItems = useMemo(
    () => navGroups.flatMap((group) => group.children),
    [navGroups],
  );

  const title = useMemo(() => {
    if (location.pathname === "/profile") return "ข้อมูลของฉัน";
    const item = navItems.find((entry) => entry.key === location.pathname);
    return item?.pageTitle || item?.label || "CMS";
  }, [location.pathname, navItems]);

  const onLogout = async () => {
    await logout();
    redirectToPortal();
  };

  const onNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const toggleCollapsed = () => setCollapsed((value) => !value);

  const displayName = user?.display_name || user?.username || "?";

  const userMenuItems = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: "ดูข้อมูลของฉัน",
      onClick: () => navigate("/profile"),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "ออกจากระบบ",
      danger: true,
      onClick: () => onLogout(),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-slate-800 bg-slate-950 transition-[width] duration-200 ease-out lg:block"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          selectedKey={location.pathname}
          onNavigate={onNavigate}
          onLogout={onLogout}
          user={user}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
          navGroups={navGroups}
        />
      </aside>

      <Drawer
        placement="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        width={SIDEBAR_EXPANDED}
        styles={{ body: { padding: 0, background: "#020617" } }}
        className="lg:hidden"
      >
        <SidebarContent
          selectedKey={location.pathname}
          onNavigate={onNavigate}
          onLogout={onLogout}
          user={user}
          navGroups={navGroups}
        />
      </Drawer>

      <div
        className="transition-[padding-left] duration-200 ease-out max-lg:!pl-0"
        style={{ paddingLeft: sidebarWidth }}
      >
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 shadow-[inset_0_2px_0_#b91c1c]">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              className="lg:!hidden"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
            />
            <Button
              type="text"
              className="!hidden lg:!inline-flex"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleCollapsed}
              title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
            />
            <div>
              <div className="text-xs text-slate-400">
                <Link to="/dashboard" className="hover:text-red-700">
                  CMS
                </Link>
                {" / "}
                {title}
              </div>
              <div className="text-sm font-semibold text-slate-800">{title}</div>
            </div>
          </div>
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={["click"]}
          >
            <button
              type="button"
              className="cursor-pointer rounded-full border-0 bg-transparent p-0"
              aria-label="เมนูบัญชีผู้ใช้"
            >
              <Avatar className="bg-red-700">
                {displayName.slice(0, 1)}
              </Avatar>
            </button>
          </Dropdown>
        </header>

        <main className="mx-auto max-w-[1280px] p-4 md:p-6">
          {user && !user.telegram_linked && location.pathname !== "/profile" ? (
            <Alert
              className="mb-4"
              type="warning"
              showIcon
              message="ทุกคนต้องผูก LFB Service"
              description="ใช้ยืนยันตัวตนและรีเซ็ตรหัสผ่านทาง Telegram — กดผูกจากหน้าข้อมูลของฉัน"
              action={
                <Button size="small" type="primary" onClick={() => navigate("/profile")}>
                  ไปผูกเลย
                </Button>
              }
            />
          ) : null}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
