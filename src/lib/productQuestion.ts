import { ATTRIBUTE_KEYWORDS } from "./needParsing";
import { normalizeSpecKey } from "./specBase";

export type QuestionTarget =
  | { kind: "attribute"; key: string }
  | { kind: "price" }
  | { kind: "stock" }
  | { kind: "seller" }
  | { kind: "unknown" };

const PRICE_RE = /\b(harga|harganya|berapaan|berapa duit|biaya|mahal|murah)\b/i;
const STOCK_RE = /\b(stok|stock|ready|tersedia|sisa|habis|masih ada|kosong)\b/i;
const SELLER_RE = /\b(penjual|seller|toko|tokonya|dijual oleh|dari toko)\b/i;

function stripSuffixes(text: string): string {
  return text.replace(/\b([a-z]{3,}?)(nya|ku|mu)\b/gi, "$1");
}

export function routeQuestion(question: string): QuestionTarget {
  const text = stripSuffixes((question ?? "").trim());
  if (!text) return { kind: "unknown" };

  if (PRICE_RE.test(text)) return { kind: "price" };
  if (STOCK_RE.test(text)) return { kind: "stock" };
  if (SELLER_RE.test(text)) return { kind: "seller" };

  for (const { pattern, key } of ATTRIBUTE_KEYWORDS) {
    if (pattern.test(text)) return { kind: "attribute", key };
  }

  for (const word of text.toLowerCase().match(/[a-z_]+/g) ?? []) {
    const key = normalizeSpecKey(word);
    if (key) return { kind: "attribute", key };
  }

  return { kind: "unknown" };
}
