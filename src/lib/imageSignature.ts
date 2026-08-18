export type ImageKind = "png" | "jpeg" | "webp" | "gif";

const EXTENSION: Record<ImageKind, string> = {
  png: "png",
  jpeg: "jpg",
  webp: "webp",
  gif: "gif",
};

const MIME: Record<ImageKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

function startsWith(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((byte, index) => buffer[offset + index] === byte);
}
export function detectImageKind(buffer: Buffer): ImageKind | null {
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return "gif";
  if (
    startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "webp";
  }

  return null;
}

export function extensionFor(kind: ImageKind): string {
  return EXTENSION[kind];
}

export function mimeFor(kind: ImageKind): string {
  return MIME[kind];
}

export type VideoKind = "mp4" | "webm";

const VIDEO_MIME: Record<VideoKind, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
};

export function detectVideoKind(buffer: Buffer): VideoKind | null {
  if (startsWith(buffer, [0x66, 0x74, 0x79, 0x70], 4)) return "mp4";
  
  if (startsWith(buffer, [0x1a, 0x45, 0xdf, 0xa3])) return "webm";
  return null;
}

export function videoMimeFor(kind: VideoKind): string {
  return VIDEO_MIME[kind];
}
