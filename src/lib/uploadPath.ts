import { env } from "../config/env";

// Jalur lokal: berkas dilayani sendiri lewat GET /uploads/:id, tanpa ekstensi.
const LOCAL_UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9-]+$/;

// Objek Supabase dinamai UUID + ekstensi, mis. "6f1c…-9a2b.gif".
const OBJECT_KEY = /^[A-Za-z0-9-]+\.[A-Za-z0-9]+$/;

function supabasePublicPrefix(): string | null {
  if (!env.SUPABASE_PROJECT_REF || !env.SUPABASE_STORAGE_BUCKET) return null;
  return `https://${env.SUPABASE_PROJECT_REF}.supabase.co/storage/v1/object/public/${env.SUPABASE_STORAGE_BUCKET}/`;
}

/**
 * Menerima hanya berkas hasil unggahan NeedBuy, dan mengembalikan bentuk yang
 * aman disimpan. Mengembalikan null untuk apa pun yang lain.
 *
 * Ada DUA bentuk sah, tergantung penyimpanan yang aktif:
 *   - Tanpa object storage: "/uploads/<id>" (dilayani backend sendiri).
 *   - Dengan Supabase: URL publik absolut milik project dan bucket kita.
 *
 * Sebelumnya hanya bentuk pertama yang diterima, sehingga di produksi — tempat
 * Supabase aktif — setiap kiriman foto ditolak "harus hasil unggahan NeedBuy"
 * padahal berkasnya sudah berhasil terunggah. Di laptop bentuknya kebetulan
 * yang pertama, jadi bug ini tidak pernah kelihatan saat pengembangan.
 */
export function normalizeUploadPath(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (LOCAL_UPLOAD_PATH.test(trimmed)) return trimmed;

  // URL Supabase disimpan utuh: frontend butuh alamat absolutnya untuk
  // menampilkan gambar, dan berkasnya memang tidak dilayani backend ini.
  const prefix = supabasePublicPrefix();
  if (prefix && trimmed.startsWith(prefix)) {
    return OBJECT_KEY.test(trimmed.slice(prefix.length)) ? trimmed : null;
  }

  try {
    const path = new URL(trimmed).pathname;
    return LOCAL_UPLOAD_PATH.test(path) ? path : null;
  } catch {
    return null;
  }
}
