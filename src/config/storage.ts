import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

/**
 * Supabase Storage lewat endpoint S3-compatible miliknya.
 *
 * Dipilih karena satu alasan praktis: kuotanya ikut paket gratis Supabase yang
 * sudah dipakai untuk database, jadi tidak perlu mendaftarkan kartu di layanan
 * mana pun.
 *
 * Sengaja OPSIONAL. Kalau variabelnya tidak diisi, modul uploads jatuh balik
 * menyimpan berkas di Postgres seperti semula. Itu yang membuat `npm run dev`
 * di laptop tetap jalan tanpa akun apa pun, dan membuat URL gambar lama tidak
 * ikut mati saat produksi pindah ke Storage.
 */
export function isObjectStorageEnabled(): boolean {
  return Boolean(
    env.SUPABASE_PROJECT_REF &&
      env.SUPABASE_S3_ACCESS_KEY_ID &&
      env.SUPABASE_S3_SECRET_ACCESS_KEY &&
      env.SUPABASE_STORAGE_BUCKET
  );
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.SUPABASE_S3_REGION,
      endpoint: `https://${env.SUPABASE_PROJECT_REF}.supabase.co/storage/v1/s3`,
      // Supabase memakai path-style (bucket di path, bukan subdomain).
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.SUPABASE_S3_ACCESS_KEY_ID!,
        secretAccessKey: env.SUPABASE_S3_SECRET_ACCESS_KEY!,
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
  const bucket = env.SUPABASE_STORAGE_BUCKET!;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      // Objek diberi nama acak dan tidak pernah ditimpa, jadi aman di-cache selamanya.
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  return `https://${env.SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/${bucket}/${key}`;
}
