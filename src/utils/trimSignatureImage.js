/**
 * Crop near-white / transparent margins from a signature image so the ink
 * fills more of the preview box (Excel-exported stamps often have huge padding).
 */
export async function trimSignatureImage(input, options = {}) {
  const {
    padding = 10,
    whiteThreshold = 248,
    alphaThreshold = 12,
  } = options;

  if (!input || typeof document === "undefined") return input;

  const sourceBlob =
    input instanceof Blob
      ? input
      : input instanceof File
        ? input
        : null;
  if (!sourceBlob) return input;

  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(sourceBlob);
    const image = new Image();
    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        if (!width || !height) {
          URL.revokeObjectURL(objectUrl);
          resolve(sourceBlob);
          return;
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          resolve(sourceBlob);
          return;
        }
        ctx.drawImage(image, 0, 0);
        const { data } = ctx.getImageData(0, 0, width, height);

        let minX = width;
        let minY = height;
        let maxX = -1;
        let maxY = -1;

        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a < alphaThreshold) continue;
            const isNearWhite =
              r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold;
            if (isNearWhite) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }

        URL.revokeObjectURL(objectUrl);

        if (maxX < minX || maxY < minY) {
          resolve(sourceBlob);
          return;
        }

        const cropX = Math.max(0, minX - padding);
        const cropY = Math.max(0, minY - padding);
        const cropW = Math.min(width - cropX, maxX - minX + 1 + padding * 2);
        const cropH = Math.min(height - cropY, maxY - minY + 1 + padding * 2);

        // Already tight enough — keep original
        const areaRatio = (cropW * cropH) / (width * height);
        if (areaRatio > 0.85) {
          resolve(sourceBlob);
          return;
        }

        const out = document.createElement("canvas");
        out.width = Math.max(1, cropW);
        out.height = Math.max(1, cropH);
        const outCtx = out.getContext("2d");
        if (!outCtx) {
          resolve(sourceBlob);
          return;
        }
        outCtx.fillStyle = "#ffffff";
        outCtx.fillRect(0, 0, out.width, out.height);
        outCtx.drawImage(
          canvas,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          cropW,
          cropH,
        );

        out.toBlob(
          (blob) => resolve(blob || sourceBlob),
          "image/png",
        );
      } catch {
        URL.revokeObjectURL(objectUrl);
        resolve(sourceBlob);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(sourceBlob);
    };
    image.src = objectUrl;
  });
}
