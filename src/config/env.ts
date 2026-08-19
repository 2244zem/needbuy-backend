import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  // Koneksi langsung untuk `prisma migrate` saat DATABASE_URL menunjuk pooler.
  // Opsional: Postgres lokal tidak butuh ini.
  DIRECT_URL: z.string().optional(),
  TEST_DATABASE_URL: z.string().optional(),

  API_BASE_URL: z.string().url().default("http://localhost:4000"),
  ALLOWED_ORIGINS: z.string().default("http://localhost:3000"),

  JWT_SECRET: z.string().min(16, "JWT_SECRET minimal 16 karakter"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16, "JWT_REFRESH_SECRET minimal 16 karakter"),
  REFRESH_EXPIRES_IN_DAYS: z.coerce.number().int().positive().default(30),

  MIDTRANS_SERVER_KEY: z
    .string()
    .regex(
      /^(SB-Mid-server-|Mid-server-)/,
      "MIDTRANS_SERVER_KEY harus kredensial SANDBOX (diawali SB-Mid-server- atau Mid-server-)."
    ),
  MIDTRANS_CLIENT_KEY: z
    .string()
    .regex(
      /^(SB-Mid-client-|Mid-client-)/,
      "MIDTRANS_CLIENT_KEY harus kredensial SANDBOX (diawali SB-Mid-client- atau Mid-client-)."
    ),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  SLOW_QUERY_MS: z.coerce.number().int().positive().default(300),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),

  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),

  FRONTEND_URL: z.string().url().default("http://localhost:5173"),

  SMTP_HOST: z.string().default("smtp.gmail.com"),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  
  MAIL_FROM_ADDRESS: z.string().email().default("needbuy.platform@gmail.com"),
  MAIL_FROM_NAME: z.string().default("NeedBuy"),

  // Supabase Storage (penyimpanan berkas). Semuanya opsional: kalau kosong,
  // modul uploads menyimpan berkas di Postgres seperti sebelumnya, jadi
  // pengembangan lokal tidak butuh akun apa pun.
  SUPABASE_PROJECT_REF: z.string().optional(),
  SUPABASE_S3_ACCESS_KEY_ID: z.string().optional(),
  SUPABASE_S3_SECRET_ACCESS_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  SUPABASE_S3_REGION: z.string().default("ap-southeast-1"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  console.error(`Konfigurasi environment tidak valid:\n${detail}`);
  process.exit(1);
}

export const env = parsed.data;

// Origin dibandingkan setelah dinormalkan: browser mengirim header `Origin`
// tanpa trailing slash dan dengan host huruf kecil, sedangkan nilai di env
// sering ditulis "https://contoh.app/" sehingga perbandingan mentah meleset.
function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/+$/, "").toLowerCase();
}

// FRONTEND_URL ikut diizinkan otomatis: origin yang dipakai untuk redirect
// OAuth pasti juga yang memanggil API, jadi tidak perlu didaftar dua kali.
export const allowedOrigins = [...env.ALLOWED_ORIGINS.split(","), env.FRONTEND_URL]
  .map(normalizeOrigin)
  .filter(Boolean)
  .filter((origin, index, list) => list.indexOf(origin) === index);

export function isOriginAllowed(origin: string): boolean {
  return allowedOrigins.includes(normalizeOrigin(origin));
}

export const isProduction = env.NODE_ENV === "production";
export const isTest = env.NODE_ENV === "test";