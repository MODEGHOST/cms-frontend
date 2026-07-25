import { Space, Typography } from "antd";

export function PageHeader({ title, description, extra }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 16,
        marginBottom: 20,
        flexWrap: "wrap",
      }}
    >
      <div>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {title}
        </Typography.Title>
        {description ? (
          <Typography.Text type="secondary">{description}</Typography.Text>
        ) : null}
      </div>
      {extra ? <Space wrap>{extra}</Space> : null}
    </div>
  );
}
