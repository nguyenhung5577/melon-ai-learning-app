export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const MAX_UPLOAD_MB = 20;

export function isOverUploadLimit(file: Pick<File, "size">) {
  return file.size > MAX_UPLOAD_BYTES;
}
