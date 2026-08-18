import { brandsInText } from "./needParsing";
import {
  canonicalCategory,
  isSpecAbsurd,
  isSpecSuspicious,
  normalizeSpecKey,
  priceSuspicion,
  requiredSpecsFor,
  specAppliesToCategory,
} from "./specBase";
import { checkTextQuality } from "./textQuality";

export type AuditIssue = {
  severity: "critical" | "warning" | "info";
  code: string;
  field: string;
  message: string;
  suggestion: string;
};

export type AuditGrade = "EXCELLENT" | "GOOD" | "FAIR" | "POOR";

export type ProductForAudit = {
  name?: string | null;
  description?: string | null;
  sku?: string | null;
  categoryName?: string | null;
  price?: number | string | null;
  attributes?: { key?: string | null; value?: string | null }[] | null;
};

export type AuditReport = {
  score: number;
  grade: AuditGrade;
  gradeMessage: string;
  summary: string;
  categoryDetected: string | null;
  issues: AuditIssue[];
  strengths: string[];
};

const SEVERITY_PENALTY: Record<AuditIssue["severity"], number> = {
  critical: 10,
  warning: 5,
  info: 1,
};

const GRADES: { min: number; grade: AuditGrade; message: string }[] = [
  { min: 90, grade: "EXCELLENT", message: "Data produk sangat rapi dan bisa dipercaya." },
  { min: 75, grade: "GOOD", message: "Data produk baik, ada sedikit catatan kecil." },
  { min: 55, grade: "FAIR", message: "Data produk cukup, tapi ada beberapa hal yang perlu diperbaiki." },
  { min: 0, grade: "POOR", message: "Data produk banyak bermasalah, sebaiknya direvisi sebelum dipublikasikan." },
];

const NAME_MIN = 3;
const NAME_MAX = 200;

const issue = (
  severity: AuditIssue["severity"],
  code: string,
  field: string,
  message: string,
  suggestion: string
): AuditIssue => ({ severity, code, field, message, suggestion });

const clean = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim());

export function auditProduct(product: ProductForAudit): AuditReport {
  const name = clean(product.name);
  const description = clean(product.description);
  const sku = clean(product.sku);
  const categoryName = clean(product.categoryName) || null;

  const issues: AuditIssue[] = [];
  const strengths: string[] = [];

  const attributes = new Map<string, string>();
  for (const attr of product.attributes ?? []) {
    const key = normalizeSpecKey(clean(attr?.key));
    const value = clean(attr?.value);
    if (!key || !value) continue;

    const existing = attributes.get(key);
    if (existing !== undefined && existing !== value) {
      issues.push(
        issue(
          "warning",
          "DUPLICATE_ATTRIBUTE",
          key,
          `spesifikasi ${key} disebut lebih dari sekali ("${existing}" vs "${value}")`,
          "Hapus salah satu dan sisakan nilai yang benar."
        )
      );
    }
    attributes.set(key, value);
  }

  if (!name) {
    issues.push(issue("critical", "MISSING_NAME", "name", "nama produk kosong", "Isi nama produk yang jelas."));
  } else if (name.length < NAME_MIN) {
    issues.push(
      issue("warning", "NAME_TOO_SHORT", "name", "nama produk terlalu pendek", "Tulis nama produk yang informatif.")
    );
  } else if (name.length > NAME_MAX) {
    issues.push(
      issue("info", "NAME_TOO_LONG", "name", "nama produk sangat panjang", "Ringkas nama menjadi kata kunci utama.")
    );
  } else {
    strengths.push(`nama produk terisi: ${name.slice(0, 60)}`);
  }

  if (!description) {
    issues.push(
      issue(
        "warning",
        "MISSING_DESCRIPTION",
        "description",
        "deskripsi produk kosong",
        "Tambahkan deskripsi singkat yang menjelaskan produk."
      )
    );
  } else {
    for (const q of checkTextQuality(description)) {
      issues.push(issue(q.severity, q.code, "description", q.message, q.suggestion));
    }
  }

  const brandsInName = brandsInText(name);
  const brandsInDescription = brandsInText(description);
  if (
    brandsInName.length > 0 &&
    brandsInDescription.length > 0 &&
    !brandsInName.some((b) => brandsInDescription.includes(b))
  ) {
    issues.push(
      issue(
        "warning",
        "BRAND_CONFLICT",
        "name/description",
        `nama produk menyebut ${brandsInName.join(", ")} tapi deskripsi menyebut ${brandsInDescription.join(
          ", "
        )}: kemungkinan salah salin`,
        "Pastikan brand di nama dan deskripsi konsisten."
      )
    );
  }

  for (const [key, value] of attributes) {
    if (!specAppliesToCategory(key, categoryName)) {
      const cat = canonicalCategory(categoryName);
      issues.push(
        issue(
          "warning",
          "IRRELEVANT_SPEC",
          key,
          `spesifikasi ${key} nggak lazim buat kategori ${cat ?? categoryName}`,
          "Hapus spesifikasi yang nggak relevan dengan produk ini."
        )
      );
    }

    const absurd = isSpecAbsurd(key, value);
    if (absurd.flagged) {
      issues.push(issue("critical", "ABSURD_SPEC", key, absurd.reason, `Periksa kembali nilai ${key}.`));
      continue;
    }

    const suspicious = isSpecSuspicious(key, value);
    if (suspicious.flagged) {
      issues.push(issue("warning", "SUSPICIOUS_SPEC", key, suspicious.reason, `Konfirmasi kembali nilai ${key}.`));
    }
  }

  const categoryDetected = canonicalCategory(categoryName);
  if (categoryDetected) {
    for (const required of requiredSpecsFor(categoryName)) {
      if (!attributes.has(required)) {
        issues.push(
          issue(
            "warning",
            "MISSING_SPEC",
            required,
            `spesifikasi penting ${required} belum diisi untuk produk ${categoryDetected}`,
            `Tambahkan ${required} supaya pembeli yakin produk sesuai kebutuhan.`
          )
        );
      }
    }
    strengths.push(`kategori terdeteksi: ${categoryDetected}`);
  }

  const rawPrice = product.price;
  const price = rawPrice === null || rawPrice === undefined || rawPrice === "" ? null : Number(rawPrice);
  if (price !== null && Number.isNaN(price)) {
    issues.push(
      issue("warning", "INVALID_PRICE", "price", "harga bukan angka yang valid", "Isi harga berupa angka (misal 1500000).")
    );
  } else if (price !== null) {
    const suspicious = priceSuspicion(categoryName, price);
    if (suspicious.flagged) {
      issues.push(issue("warning", "SUSPICIOUS_PRICE", "price", suspicious.reason, "Periksa kembali harga jual produk."));
    } else if (price > 0) {
      strengths.push(`harga terisi dan wajar: Rp${Math.round(price).toLocaleString("id-ID")}`);
    }
  }

  if (!sku) {
    issues.push(
      issue("info", "MISSING_SKU", "sku", "SKU nggak diisi", "SKU memudahkan pencatatan stok dan penjualan.")
    );
  }

  const score = scoreFor(issues);
  const { grade, message } = gradeFor(score);

  return {
    score,
    grade,
    gradeMessage: message,
    summary: summarize(score, issues, strengths),
    categoryDetected,
    issues,
    strengths,
  };
}

function scoreFor(issues: AuditIssue[]): number {
  const penalty = issues.reduce((sum, i) => sum + SEVERITY_PENALTY[i.severity], 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function gradeFor(score: number): { grade: AuditGrade; message: string } {
  const found = GRADES.find((g) => score >= g.min) ?? GRADES[GRADES.length - 1];
  return { grade: found.grade, message: found.message };
}

function summarize(score: number, issues: AuditIssue[], strengths: string[]): string {
  const critical = issues.filter((i) => i.severity === "critical").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  if (critical === 0 && warnings === 0) {
    return "Data produk bersih, nggak ketemu masalah berarti.";
  }

  const parts = [`Skor kualitas ${score}/100.`];
  if (critical) parts.push(`${critical} masalah kritis`);
  if (warnings) parts.push(`${warnings} peringatan`);
  if (strengths.length) parts.push(`${strengths.length} poin baik`);
  return `${parts.join(" ")}. Detail di bawah.`;
}
