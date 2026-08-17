/**
 * Compress image files in the browser before upload.
 * Non-images are returned unchanged. If compression fails or result is larger, keeps original.
 */

export function revokeBlobUrl(url) {
  if (url && String(url).startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
}

/** Revoke blob: URLs attached to Ant Design Upload file items. */
export function revokeUploadFileListUrls(fileList = []) {
  for (const item of fileList || []) {
    if (!item) continue;
    revokeBlobUrl(item.thumbUrl);
    revokeBlobUrl(item.url);
    revokeBlobUrl(item._localPreviewUrl);
    if (item._localPreviewUrl) item._localPreviewUrl = null;
  }
}

/** PDFKit รองรับแค่ JPEG/PNG — WebP/AVIF ฯลฯ ต้องแปลงก่อนอัปโหลด */
const PDF_SAFE_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

export async function compressImageFile(file, options = {}) {
  if (!file || typeof File === "undefined") return file;
  if (!String(file.type || "").startsWith("image/")) return file;

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.72,
    mimeType = "image/jpeg",
  } = options;

  // Animated GIF / SVG — leave alone
  const type = String(file.type || "").toLowerCase();
  if (type === "image/gif" || type === "image/svg+xml") return file;

  // WebP/AVIF ฯลฯ ต้องแปลงแม้ไฟล์เล็ก (ไม่งั้น PDF ใส่รูปไม่ได้)
  const forceConvert = !PDF_SAFE_IMAGE_TYPES.has(type);
  // Skip tiny images that PDF already accepts
  if (!forceConvert && file.size > 0 && file.size < 80 * 1024) return file;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        let { width, height } = image;
        if (!width || !height) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }

        const scale = Math.min(1, maxWidth / width, maxHeight / height);
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(file);
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(image, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            // บังคับแปลงฟอร์แมตที่ไม่ปลอดภัยต่อ PDF แม้ผลลัพธ์จะใหญ่กว่าต้นฉบับ
            if (!blob || (!forceConvert && blob.size >= file.size)) {
              resolve(file);
              return;
            }
            const baseName = String(file.name || "image").replace(/\.[^.]+$/, "");
            const compressed = new File([blob], `${baseName}.jpg`, {
              type: mimeType,
              lastModified: Date.now(),
            });
            resolve(compressed);
          },
          mimeType,
          quality,
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(file);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };
    image.src = objectUrl;
  });
}

/** Compress only newly added image items in an Ant Design Upload fileList. */
export async function compressUploadFileList(fileList = []) {
  const next = [];
  for (const item of fileList) {
    if (item?.attachmentId || !item?.originFileObj) {
      next.push(item);
      continue;
    }
    const raw = item.originFileObj;
    if (!String(raw.type || "").startsWith("image/")) {
      next.push(item);
      continue;
    }
    // Already compressed in a previous pass
    if (item.compressed) {
      next.push(item);
      continue;
    }
    const compressed = await compressImageFile(raw);
    if (compressed === raw) {
      next.push({
        ...item,
        compressed: true,
        thumbUrl:
          item.thumbUrl ||
          (String(raw.type || "").startsWith("image/")
            ? URL.createObjectURL(raw)
            : item.thumbUrl),
      });
      continue;
    }
    if (item.thumbUrl?.startsWith("blob:")) {
      revokeBlobUrl(item.thumbUrl);
    }
    next.push({
      ...item,
      originFileObj: compressed,
      name: compressed.name,
      size: compressed.size,
      type: compressed.type,
      thumbUrl: URL.createObjectURL(compressed),
      compressed: true,
    });
  }
  return next;
}
