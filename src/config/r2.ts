import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

/**
 * Cloudflare R2 lewat API S3-compatible.
 *
 * Sengaja OPSIONAL: kalau keempat variabelnya tidak diisi, modul uploads jatuh
 * balik menyimpan berkas di Postgres seperti sebelumnya. Itu yang membuat
 * `npm run dev` di laptop tetap jalan tanpa akun Cloudflare, dan membuat URL
 * gambar lama tidak ikut mati saat produksi pindah ke R2.
 */
export function isR2Enabled(): boolean {
  return Boolean(
    env.R2_ACCOUNT_ID &&
      env.R2_ACCESS_KEY_ID &&
      env.R2_SECRET_ACCESS_KEY &&
      env.R2_BUCKET &&
      env.R2_PUBLIC_URL
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      // R2 tidak punya region sungguhan; "auto" adalah nilai yang diminta docs-nya.
      region: "auto",
      endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID!,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return client;
}

/** Unggah satu objek dan kembalikan URL publiknya. */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string> {
  await getClient().send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Objek diberi nama acak dan tidak pernah ditimpa, jadi aman di-cache selamanya.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `${env.R2_PUBLIC_URL!.replace(/\/$/, "")}/${key}`;
}
