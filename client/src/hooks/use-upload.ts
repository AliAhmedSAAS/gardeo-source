import { useState, useCallback } from "react";
import type { UppyFile } from "@uppy/core";

interface UploadMetadata {
  name: string;
  size: number;
  contentType: string;
}

interface UploadResponse {
  uploadURL: string;
  objectPath: string;
  metadata: UploadMetadata;
}

interface UseUploadOptions {
  onSuccess?: (response: UploadResponse) => void;
  onError?: (error: Error) => void;
}

/** Parse response as JSON only if Content-Type is JSON; avoids "Unexpected token '<'" when server returns HTML. */
async function safeJson<T = unknown>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    if (text.trimStart().startsWith("<!") || text.trimStart().startsWith("<html")) {
      throw new Error(
        "Server returned a page instead of JSON. Use the same URL as your app (e.g. the port from 'npm run dev') and restart the server."
      );
    }
    throw new Error("Unexpected response format");
  }
  return response.json();
}

/**
 * React hook for handling file uploads with presigned URLs or direct upload.
 *
 * Tries direct upload first (works without Replit storage), then presigned URL if needed.
 */
export function useUpload(options: UseUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState(0);

  /**
   * Upload file directly to server (primary path; always works when API is on same origin).
   */
  const directUpload = useCallback(async (file: File): Promise<UploadResponse> => {
    const response = await fetch("/api/uploads/upload", {
      method: "POST",
      headers: {
        "X-File-Name": file.name,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
      credentials: "include",
    });

    const data = await safeJson<{ objectPath?: string; metadata?: UploadMetadata; error?: string; message?: string }>(response);

    if (!response.ok) {
      throw new Error(data.error || data.message || "Upload failed");
    }

    return {
      uploadURL: "",
      objectPath: (data as { objectPath: string }).objectPath,
      metadata: (data as { metadata?: UploadMetadata }).metadata ?? {
        name: file.name,
        size: file.size,
        contentType: file.type || "application/octet-stream",
      },
    };
  }, []);

  /**
   * Request a presigned URL from the backend (optional; for Replit object storage).
   */
  const requestUploadUrl = useCallback(
    async (file: File): Promise<UploadResponse & { useDirectUpload?: boolean }> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
        credentials: "include",
      });

      const data = await safeJson<UploadResponse & { useDirectUpload?: boolean; error?: string }>(response);

      if (!response.ok) {
        if (data.useDirectUpload) throw new Error("USE_DIRECT_UPLOAD");
        throw new Error(data.error || "Failed to get upload URL");
      }

      return data;
    },
    []
  );

  /**
   * Upload a file directly to the presigned URL.
   */
  const uploadToPresignedUrl = useCallback(
    async (file: File, uploadURL: string): Promise<void> => {
      const response = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to upload file to storage");
      }
    },
    []
  );

  /**
   * Upload a file using the presigned URL flow.
   *
   * @param file - The file to upload
   * @returns The upload response containing the object path
   */
  const uploadFile = useCallback(
    async (file: File): Promise<UploadResponse | null> => {
      setIsUploading(true);
      setError(null);
      setProgress(0);

      try {
        setProgress(20);
        // Use direct upload first (always registered on the same server; avoids HTML response from wrong host)
        const uploadResponse = await directUpload(file);
        setProgress(100);
        options.onSuccess?.(uploadResponse);
        return uploadResponse;
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Upload failed");
        setError(error);
        options.onError?.(error);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [directUpload, options]
  );

  /**
   * Get upload parameters for Uppy's AWS S3 plugin.
   *
   * IMPORTANT: This function receives the UppyFile object from Uppy.
   * Use file.name, file.size, file.type to request per-file presigned URLs.
   *
   * Use this with the ObjectUploader component:
   * ```tsx
   * <ObjectUploader onGetUploadParameters={getUploadParameters}>
   *   Upload
   * </ObjectUploader>
   * ```
   */
  const getUploadParameters = useCallback(
    async (
      file: UppyFile<Record<string, unknown>, Record<string, unknown>>
    ): Promise<{
      method: "PUT";
      url: string;
      headers?: Record<string, string>;
    }> => {
      const response = await fetch("/api/uploads/request-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type || "application/octet-stream",
        }),
        credentials: "include",
      });

      const data = await safeJson<{ uploadURL?: string }>(response);
      if (!response.ok || !data.uploadURL) {
        throw new Error("Failed to get upload URL");
      }
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      };
    },
    []
  );

  return {
    uploadFile,
    getUploadParameters,
    isUploading,
    error,
    progress,
  };
}

