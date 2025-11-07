import { getSupabase } from "./supabase.js";

const API_BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

if (!API_BASE_URL) {
  console.warn("VITE_API_URL is not set. API calls may fail.");
}

export interface UploadSignedUrlResponse {
  uploadUrl: string;
  objectKey: string;
  fileId: string;
  expiresIn: number;
}

/**
 * Get a signed URL for uploading a file
 */
export async function getUploadSignedUrl(
  filename: string,
  contentType: string,
  directory?: string
): Promise<UploadSignedUrlResponse> {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/uploads/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      filename,
      contentType,
      directory,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get upload URL: ${error}`);
  }

  return response.json();
}

/**
 * Upload a file to a signed URL
 */
export async function uploadFileToSignedUrl(
  file: File,
  signedUrl: string
): Promise<void> {
  const response = await fetch(signedUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }
}
