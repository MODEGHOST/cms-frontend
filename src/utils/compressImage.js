/**
 * Compress image files in the browser before upload.
 * Non-images are returned unchanged. If compression fails or result is larger, keeps original.
 */
export async function compressImageFile(file, options = {}) {
  if (!file || typeof File === "undefined") return file;
  if (!String(file.type || "").startsWith("image/")) return file;
  // Skip tiny images — already small enough
  if (file.size > 0 && file.size < 80 * 1024) return file;

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    quality = 0.72,
    mimeType = "image/jpeg",
  } = options;

  // Animated GIF / SVG — leave alone
  const type = String(file.type || "").toLowerCase();
  if (type === "image/gif" || type === "image/svg+xml") return file;

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
            if (!blob || blob.size >= file.size) {
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
      try {
        URL.revokeObjectURL(item.thumbUrl);
      } catch {
        /* ignore */
      }
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
