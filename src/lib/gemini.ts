import { env } from "../config/env";
import { logger } from "../config/logger";

// Klien Gemini seadanya lewat fetch bawaan Node 20. Sengaja tanpa SDK: yang
// dibutuhkan cuma satu panggilan generateContent dengan keluaran JSON, dan
// menambah dependency untuk itu tidak sepadan.

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";
const TIMEOUT_MS = 8000;

export function isGeminiConfigured(): boolean {
  return Boolean(env.GEMINI_API_KEY);
}

/**
 * Meminta Gemini membalas JSON yang mengikuti `responseSchema`.
 * Mengembalikan null kalau Gemini tidak dikonfigurasi, lambat, atau balasannya
 * tidak bisa dibaca — pemanggil wajib punya jalur cadangan sendiri. Pencarian
 * tidak boleh ikut mati hanya karena layanan AI sedang bermasalah.
 */
export async function generateJson<T = unknown>(
  prompt: string,
  responseSchema: Record<string, unknown>
): Promise<T | null> {
  if (!env.GEMINI_API_KEY) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(
      `${ENDPOINT}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: "application/json",
            responseSchema,
          },
        }),
      }
    );

    if (!res.ok) {
      logger.warn({ status: res.status }, "gemini menolak permintaan");
      return null;
    }

    const body = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    logger.warn({ err: error }, "gemini gagal dipanggil, pakai jalur cadangan");
    return null;
  } finally {
    clearTimeout(timer);
  }
}
