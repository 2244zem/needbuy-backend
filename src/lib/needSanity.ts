import {
  CATEGORY_PRICE_RANGE,
  canonicalCategory,
  isSpecAbsurd,
  isSpecSuspicious,
  specAppliesToCategory,
} from "./specBase";
import {
  hasPlaceholder,
  hasRepeatedChars,
  isEmojiOnly,
  isSingleCharRepeat,
} from "./textQuality";

export type SanityIssue = {
  severity: "critical" | "warning";
  code: string;
  message: string;
  suggestion?: string;
};

export type SanityInput = {
  rawInput: string;
  requirements: { key: string; value: string }[];
  categorySlug: string | null;
  budget: number | null;
};

export type SanityReport = {
  detected: boolean;
  notes: string[];
  issues: SanityIssue[];
};

const BUDGET_FLOOR_RATIO = 0.5;

export function checkNeedSanity(input: SanityInput): SanityReport {
  const issues: SanityIssue[] = [];
  const raw = input.rawInput ?? "";

  if (!raw.trim()) {
    issues.push({
      severity: "critical",
      code: "EMPTY_INPUT",
      message: "input kosong: nggak ada yang bisa dianalisis",
      suggestion: "Tulis kebutuhanmu, misal 'butuh laptop untuk kuliah, budget 8 juta'.",
    });
  } else {
    if (isEmojiOnly(raw)) {
      issues.push({
        severity: "critical",
        code: "EMOJI_ONLY",
        message: "input hanya berisi emoji, nggak bisa dipahami",
        suggestion: "Tulis kebutuhanmu dalam bentuk kalimat.",
      });
    }
    if (isSingleCharRepeat(raw)) {
      issues.push({
        severity: "critical",
        code: "GIBBERISH_INPUT",
        message: "input berupa karakter berulang tanpa makna",
        suggestion: "Tulis kebutuhanmu dalam kalimat yang jelas.",
      });
    } else if (hasRepeatedChars(raw)) {
      issues.push({
        severity: "warning",
        code: "REPEATED_CHARS",
        message: "input mengandung karakter berulang yang nggak wajar",
      });
    }
    if (hasPlaceholder(raw)) {
      issues.push({
        severity: "warning",
        code: "PLACEHOLDER_TEXT",
        message: "input terlihat seperti teks contoh, bukan kebutuhan nyata",
      });
    }
  }

  const seen = new Map<string, string>();
  for (const req of input.requirements) {
    const key = req.key.toLowerCase();

    if (seen.has(key) && seen.get(key) !== req.value) {
      issues.push({
        severity: "warning",
        code: "CONTRADICTORY_SPEC",
        message: `kebutuhan ${key} disebut dua kali dengan nilai berbeda (${seen.get(
          key
        )!} vs ${req.value})`,
        suggestion: "Sebutkan satu nilai saja untuk setiap spesifikasi.",
      });
    }
    seen.set(key, req.value);

    if (!specAppliesToCategory(key, input.categorySlug)) {
      const cat = canonicalCategory(input.categorySlug);
      issues.push({
        severity: "warning",
        code: "IRRELEVANT_SPEC",
        message: `spesifikasi ${key} biasanya tidak relevan untuk produk kategori ${
          cat ?? input.categorySlug
        }`,
        suggestion: "Periksa apakah kamu mencampur kebutuhan kategori lain.",
      });
    }

    const absurd = isSpecAbsurd(key, req.value);
    if (absurd.flagged) {
      issues.push({
        severity: "critical",
        code: "ABSURD_SPEC",
        message: absurd.reason,
        suggestion: `Periksa kembali nilai ${key}.`,
      });
      continue;
    }

    const suspicious = isSpecSuspicious(key, req.value);
    if (suspicious.flagged) {
      issues.push({ severity: "warning", code: "SUSPICIOUS_SPEC", message: suspicious.reason });
    }
  }

  const cat = canonicalCategory(input.categorySlug);
  const floor = cat ? CATEGORY_PRICE_RANGE[cat]?.[0] : undefined;
  if (input.budget !== null && floor && input.budget < floor * BUDGET_FLOOR_RATIO) {
    issues.push({
      severity: "warning",
      code: "BUDGET_TOO_LOW",
      message: `budget Rp${input.budget.toLocaleString(
        "id-ID"
      )} kemungkinan terlalu kecil untuk kategori ${cat}`,
      suggestion: "Naikkan budget atau cari produk alternatif.",
    });
  }

  const critical = issues.some((i) => i.severity === "critical");
  const notes = [...new Set(issues.map((i) => i.message))];
  return { detected: critical, notes, issues };
}
