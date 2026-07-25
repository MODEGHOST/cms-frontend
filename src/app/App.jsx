import { ConfigProvider, App as AntApp } from "antd";
import thTH from "antd/locale/th_TH";
import { SessionProvider } from "../hooks/useSession";
import { AppRoutes } from "./routes";

export default function App() {
  return (
    <ConfigProvider
      locale={thTH}
      theme={{
        token: {
          colorPrimary: "#b91c1c",
          colorLink: "#b91c1c",
          borderRadius: 10,
          fontFamily: '"Noto Sans Thai", "Segoe UI", system-ui, sans-serif',
        },
      }}
    >
      <AntApp>
        <SessionProvider>
          <AppRoutes />
        </SessionProvider>
      </AntApp>
    </ConfigProvider>
  );
}
