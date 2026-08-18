export type TextIssue = {
  severity: "critical" | "warning" | "info";
  code: string;
  message: string;
  suggestion: string;
};

const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}️←-⇿]/gu;
const REPEAT_RE = /(.)\1{3,}/;
const CONSONANT_JUMBLE_RE = /[bcdfghjklmnpqrstvwxyz]{5,}/i;
const SHOUTING_RE = /[A-Z]{4,}/;
const WORD_RE = /[a-zA-Z0-9]+/g;

export const PLACEHOLDER_WORDS = new Set([
  "lorem", "ipsum", "xxx", "test", "testing", "tes", "asd", "asdasd",
  "qwerty", "contoh", "example", "sample", "dummy", "blabla", "placeholder",
  "isi", "delete", "sample1", "aaa",
]);

export function isEmojiOnly(text: string): boolean {
  const stripped = text.replace(EMOJI_RE, "").trim();
  return text.trim().length > 0 && stripped.length === 0;
}

export function isSingleCharRepeat(text: string): boolean {
  const alnum = [...text.toLowerCase()].filter((c) => /[a-z0-9]/.test(c));
  return alnum.length >= 3 && new Set(alnum).size === 1;
}

export function hasRepeatedChars(text: string): boolean {
  return REPEAT_RE.test(text);
}

export function hasPlaceholder(text: string): boolean {
  const words = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  return words.some((w) => PLACEHOLDER_WORDS.has(w));
}

export function hasConsonantJumble(text: string): boolean {
  return CONSONANT_JUMBLE_RE.test(text);
}

export function isShouting(text: string): boolean {
  return SHOUTING_RE.test(text);
}

export function wordyRatio(text: string): number {
  const words = text.match(WORD_RE) ?? [];
  if (words.length === 0) return 0;
  const letters = words.reduce((sum, w) => sum + w.length, 0);
  return letters / Math.max(text.length, 1);
}

const MIN_LENGTH = 10;
const MAX_LENGTH = 5000;

export function checkTextQuality(text: string): TextIssue[] {
  const stripped = (text ?? "").trim();

  if (!stripped) {
    return [
      {
        severity: "critical",
        code: "EMPTY_TEXT",
        message: "teks kosong",
        suggestion: "Tulis deskripsi yang jelas dan informatif.",
      },
    ];
  }

  const issues: TextIssue[] = [];

  if (isEmojiOnly(stripped)) {
    issues.push({
      severity: "critical",
      code: "EMOJI_ONLY",
      message: "teks hanya berisi emoji tanpa keterangan",
      suggestion: "Tambahkan keterangan produk dalam bentuk teks.",
    });
  }

  if (hasPlaceholder(stripped)) {
    issues.push({
      severity: "critical",
      code: "PLACEHOLDER_TEXT",
      message: "teks terlihat seperti placeholder atau template contoh",
      suggestion: "Ganti dengan deskripsi produk yang sebenarnya.",
    });
  }

  if (isSingleCharRepeat(stripped)) {
    issues.push({
      severity: "critical",
      code: "REPEATED_CHARS",
      message: "deskripsi berupa karakter berulang tanpa makna",
      suggestion: "Tulis deskripsi produk dengan kalimat yang jelas.",
    });
  } else if (hasRepeatedChars(stripped)) {
    issues.push({
      severity: "warning",
      code: "REPEATED_CHARS",
      message: "terdapat karakter berulang nggak wajar (mis. 'aaaa')",
      suggestion: "Ketik ulang deskripsi dengan ejaan yang benar.",
    });
  }

  if (hasConsonantJumble(stripped) && wordyRatio(stripped) < 0.5) {
    issues.push({
      severity: "warning",
      code: "GIBBERISH_TEXT",
      message: "teks terlihat seperti huruf acak, bukan kata bermakna",
      suggestion: "Tulis deskripsi menggunakan kata yang mudah dibaca.",
    });
  }

  if (stripped.length < MIN_LENGTH) {
    issues.push({
      severity: "warning",
      code: "TEXT_TOO_SHORT",
      message: `deskripsi terlalu pendek (kurang dari ${MIN_LENGTH} karakter)`,
      suggestion: "Tambah keterangan spek, kondisi, dan kelebihan produk.",
    });
  }

  if (stripped.length > MAX_LENGTH) {
    issues.push({
      severity: "info",
      code: "TEXT_TOO_LONG",
      message: "deskripsi sangat panjang, bisa jadi hasil salin tempel",
      suggestion: "Ringkas deskripsi supaya mudah dibaca pembeli.",
    });
  }

  if (isShouting(stripped)) {
    issues.push({
      severity: "info",
      code: "ALL_CAPS",
      message: "deskripsi memakai huruf kapital berlebihan (terlihat berteriak)",
      suggestion: "Gunakan huruf biasa supaya lebih profesional.",
    });
  }

  return issues;
}
