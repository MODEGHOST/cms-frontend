import { useEffect, useMemo, useState } from "react";
import { Avatar, Button, Drawer, Menu, Tooltip } from "antd";
import {
  DashboardOutlined,
  DatabaseOutlined,
  FileSearchOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
} from "@ant-design/icons";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSession } from "../hooks/useSession";

const NAV = [
  { key: "/dashboard", icon: <DashboardOutlined />, label: "Dashboard Reject" },
  { key: "/rejects", icon: <FileSearchOutlined />, label: "รายการ Reject" },
  { key: "/masters", icon: <DatabaseOutlined />, label: "Master Data" },
];

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
              Complaint
              <br />
              Management System
            </div>
            <div className="mt-1 flex items-center gap-2 text-[10px] tracking-[0.08em] text-red-300">
              <span>LEE FIBREBOARD</span>
              <span className="tracking-normal text-slate-500">Reject</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className={`flex-1 overflow-y-auto py-4 ${collapsed ? "px-2" : "px-3"}`}>
        {!collapsed ? (
          <div className="mb-2 px-3 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            เมนูหลัก
          </div>
        ) : null}
        <Menu
          theme="dark"
          mode="inline"
          inlineCollapsed={collapsed}
          selectedKeys={[selectedKey]}
          className="border-none !bg-transparent"
          style={{ borderInlineEnd: "none" }}
          items={NAV.map((item) => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
            title: item.label,
            onClick: () => onNavigate(item.key),
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
                <div className="text-xs text-slate-400">{user?.role || "-"}</div>
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
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
    } catch {
      // ignore storage errors
    }
  }, [collapsed]);

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  const title = useMemo(() => {
    return NAV.find((item) => item.key === location.pathname)?.label || "CMS";
  }, [location.pathname]);

  const onLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const onNavigate = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  const toggleCollapsed = () => setCollapsed((value) => !value);

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
          <Avatar className="bg-red-100 text-red-700">
            {(user?.display_name || user?.username || "?").slice(0, 1)}
          </Avatar>
        </header>

        <main className="mx-auto max-w-[1280px] p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
