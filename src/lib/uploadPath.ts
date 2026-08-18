const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9-]+$/;

export function normalizeUploadPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (UPLOAD_PATH.test(trimmed)) return trimmed;

  try {
    const path = new URL(trimmed).pathname;
    return UPLOAD_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}
