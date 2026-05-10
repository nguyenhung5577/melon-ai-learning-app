export interface UploadResult {
  url: string;
  publicId?: string;
  bytes?: number;
}

/**
 * Uploads a file using the backend API route, which forwards to Cloudinary.
 * Used for both PDFs and images.
 */
export async function uploadFile(
  file: File,
  folder: string = "melon",
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("folder", folder);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          onProgress(progress);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const result = JSON.parse(xhr.responseText);
          if (result.error) throw new Error(result.error);
          resolve({
            url: result.url,
            publicId: result.publicId,
          });
        } catch (e: any) {
          reject(e);
        }
      } else {
        reject(new Error(`Upload failed with status: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(formData);
  });
}

/**
 * Convenience wrapper for avatar uploads
 */
export async function uploadAvatar(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadFile(file, "melon/avatars", onProgress);
  return result.url;
}

/**
 * Convenience wrapper for PDF uploads
 */
export async function uploadPdf(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const result = await uploadFile(file, "melon/pdfs", onProgress);
  return result.url;
}
