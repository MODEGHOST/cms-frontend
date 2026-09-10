import { useState } from "react";
import { App, Button, Image, Popconfirm, Space, Upload } from "antd";
import { DeleteOutlined, UploadOutlined } from "@ant-design/icons";
import { masterApi } from "../../services/api";

export function ProblemImageCell({ row, canEdit, onUpdated }) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);
  const imageUrl = row.image_url || (row.has_image ? masterApi.problemImageUrl(row.id) : null);

  const uploadFile = async (file) => {
    setUploading(true);
    try {
      await masterApi.uploadProblemImage(row.id, file);
      message.success("อัปโหลดรูปแล้ว");
      onUpdated?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setUploading(false);
    }
    return false;
  };

  const removeImage = async () => {
    setUploading(true);
    try {
      await masterApi.deleteProblemImage(row.id);
      message.success("ลบรูปแล้ว");
      onUpdated?.();
    } catch (err) {
      message.error(err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <Space size={8} align="center">
      {imageUrl ? (
        <Image
          src={imageUrl}
          alt={row.name}
          width={48}
          height={48}
          style={{ objectFit: "cover", borderRadius: 8 }}
          preview={{ mask: "ดู" }}
        />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-100 text-[11px] text-slate-500">
          ไม่มีรูป
        </div>
      )}
      {canEdit ? (
        <>
          <Upload
            accept="image/jpeg,image/png,image/webp,image/gif"
            showUploadList={false}
            beforeUpload={uploadFile}
            disabled={uploading}
          >
            <Button size="small" icon={<UploadOutlined />} loading={uploading}>
              {imageUrl ? "เปลี่ยน" : "อัปโหลด"}
            </Button>
          </Upload>
          {imageUrl ? (
            <Popconfirm title="ลบรูปนี้?" onConfirm={removeImage}>
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={uploading}
              />
            </Popconfirm>
          ) : null}
        </>
      ) : null}
    </Space>
  );
}
