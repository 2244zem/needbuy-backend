import { randomUUID } from "node:crypto";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { isObjectStorageEnabled, putObject } from "../../config/storage";
import { AppError } from "../../lib/apiError";
import {
  detectImageKind,
  detectVideoKind,
  extensionFor,
  mimeFor,
  videoMimeFor,
} from "../../lib/imageSignature";

export const UPLOAD_URL_PREFIX = "/uploads";

export async function saveImage(
  buffer: Buffer,
  uploadedById?: string
): Promise<{ id: string; url: string; bytes: number; kind: "IMAGE" | "VIDEO" }> {
  if (!buffer || buffer.length === 0) {
    throw AppError.badRequest("Berkas kosong.", "EMPTY_FILE");
  }

  const imageKind = detectImageKind(buffer);
  const videoKind = imageKind ? null : detectVideoKind(buffer);
  if (!imageKind && !videoKind) {
    throw AppError.badRequest(
      "Berkas harus gambar (PNG, JPG, WebP, GIF) atau video (MP4, WebM). SVG belum didukung.",
      "UNSUPPORTED_MEDIA"
    );
  }

  const mimeType = imageKind ? mimeFor(imageKind) : videoMimeFor(videoKind!);
  const kind = imageKind ? ("IMAGE" as const) : ("VIDEO" as const);

  // Jalur produksi: berkas ke Supabase Storage, baris Upload tidak dibuat.
  // Gambar di dalam Postgres akan menghabiskan kuota database gratis (500 MB)
  // jauh sebelum kuota penyimpanan objek (1 GB) habis.
  if (isObjectStorageEnabled()) {
    const extension = imageKind ? extensionFor(imageKind) : videoKind!;
    const key = `${randomUUID()}.${extension}`;
    const url = await putObject(key, buffer, mimeType);

    return { id: key, url, bytes: buffer.length, kind };
  }

  // Jalur lokal / cadangan: tetap di Postgres, dilayani lewat `GET /uploads/:id`.
  const upload = await prisma.upload.create({
    data: {
      mimeType,
      size: buffer.length,
      data: buffer,
      uploadedById: uploadedById ?? null,
    },
    select: { id: true, size: true },
  });

  return {
    id: upload.id,
    url: `${env.API_BASE_URL}${UPLOAD_URL_PREFIX}/${upload.id}`,
    bytes: upload.size,
    kind,
  };
}

export async function getImage(id: string) {
  const upload = await prisma.upload.findUnique({
    where: { id },
    select: { id: true, mimeType: true, size: true, data: true },
  });
  if (!upload) throw AppError.notFound("Berkas nggak ketemu.");
  return upload;
}
