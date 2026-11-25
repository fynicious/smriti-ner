'use client';

/**
 * Compresses user-selected images cleanly in the browser before upload
 * so budget Android devices and offline sync stay fast and compact (<= ~250KB).
 */
export async function compressImageFileToDataUrl(
  file: File,
  maxDimension = 1024,
  quality = 0.78
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl.startsWith('data:image/')) {
        resolve(dataUrl);
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(dataUrl);
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width || 1, img.height || 1));
        const targetW = Math.max(1, Math.round((img.width || 1) * scale));
        const targetH = Math.max(1, Math.round((img.height || 1) * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);

        try {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp') && webp.length < dataUrl.length) {
            resolve(webp);
            return;
          }
          const jpeg = canvas.toDataURL('image/jpeg', quality);
          resolve(jpeg.length < dataUrl.length ? jpeg : dataUrl);
        } catch {
          resolve(dataUrl);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
