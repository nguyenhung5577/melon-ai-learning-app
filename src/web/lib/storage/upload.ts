import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { storage } from "@/lib/auth/firebase";

export interface UploadProgress {
  bytesTransferred: number;
  totalBytes: number;
  percent: number;
}

/**
 * Upload a file to Firebase Storage.
 * Returns the public download URL.
 * `path` example: "pdfs/lesson-006/notes.pdf" or "avatars/user123.jpg"
 */
export async function uploadFile(
  file: File,
  path: string,
  onProgress?: (p: UploadProgress) => void
): Promise<string> {
  if (!storage) throw new Error("Firebase Storage not configured — add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET to .env.local");

  const storageRef = ref(storage, path);
  const task = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    task.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          onProgress({
            bytesTransferred: snapshot.bytesTransferred,
            totalBytes:       snapshot.totalBytes,
            percent:          Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
          });
        }
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/** Delete a file given its full Storage path (not URL). */
export async function deleteFile(path: string): Promise<void> {
  if (!storage) return;
  await deleteObject(ref(storage, path));
}

/** Derive the Storage path from a lesson ID and file. */
export function pdfPath(lessonId: string, fileName: string) {
  return `pdfs/${lessonId}/${fileName}`;
}

/** Derive the Storage path for a user avatar. */
export function avatarPath(userId: string, ext = "jpg") {
  return `avatars/${userId}.${ext}`;
}
