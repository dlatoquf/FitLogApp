import { API_URL } from "@/constants/api";
import * as FileSystem from "expo-file-system/legacy";

export async function uploadToS3(
  localUri: string,
  contentType: string,
  folder: string,
  token: string
): Promise<string> {
  // 1. 백엔드에서 Presigned URL 발급
  const res = await fetch(`${API_URL}/api/storage/presigned-url`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ contentType, folder }),
  });
  if (!res.ok) throw new Error("Presigned URL 발급 실패");
  const { uploadUrl, publicUrl } = await res.json();

  // 2. FileSystem.uploadAsync로 직접 PUT 업로드 (blob 변환 없이 빠름)
  const uploadRes = await FileSystem.uploadAsync(uploadUrl, localUri, {
    httpMethod: "PUT",
    headers: { "Content-Type": contentType },
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });

  if (uploadRes.status < 200 || uploadRes.status >= 300) {
    throw new Error("S3 업로드 실패");
  }

  return publicUrl;
}
