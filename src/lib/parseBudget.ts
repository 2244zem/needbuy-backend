const MULTIPLIERS: { pattern: RegExp; factor: number }[] = [
  { pattern: /^(?:m|jt|juta)$/i, factor: 1_000_000 },
  { pattern: /^(?:rb|ribu|k)$/i, factor: 1_000 },
  { pattern: /^(?:milyar|miliar|b)$/i, factor: 1_000_000_000 },
];

const UNIT = "m|jt|juta|rb|ribu|k|milyar|miliar|b";

const NUMBER_WORDS: Record<string, number> = {
  sepuluh: 10,
  sembilan: 9,
  delapan: 8,
  tujuh: 7,
  enam: 6,
  lima: 5,
  empat: 4,
  tiga: 3,
  dua: 2,
  satu: 1,
  se: 1,
};

const WORD_ALTERNATION = Object.keys(NUMBER_WORDS).join("|");

function wordsToDigits(text: string): string {
  return text
    .replace(new RegExp(`\\bsetengah\\s*(${UNIT})\\b`, "gi"), "0.5 $1")
    .replace(
      new RegExp(`\\b(${WORD_ALTERNATION})\\s*ratus\\s*(ribu|rb)\\b`, "gi"),
      (_m, word: string) => `${NUMBER_WORDS[word.toLowerCase()] * 100} ribu`
    )
    .replace(
      new RegExp(`\\b(${WORD_ALTERNATION})\\s*(${UNIT})\\b`, "gi"),
      (_m, word: string, unit: string) => `${NUMBER_WORDS[word.toLowerCase()]} ${unit}`
    );
}

function rangeToUpperBound(text: string): string {
  return text.replace(
    new RegExp(
      `(\\d+(?:[.,]\\d+)?)\\s*(?:-|–|sampai|s\\/d|sd|hingga)\\s*(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})\\b`,
      "gi"
    ),
    (_m, _low: string, high: string, unit: string) => `${high} ${unit}`
  );
}

export function parseBudget(input: string): number | null {
  if (!input) return null;
  const text = rangeToUpperBound(wordsToDigits(input.toLowerCase()));

  const withUnit = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${UNIT})(?:[-\\s]?an)?\\b`, "i").exec(text);
  if (withUnit) {
    const amount = toNumber(withUnit[1]);
    const multiplier = MULTIPLIERS.find((m) => m.pattern.test(withUnit[2]));
    if (amount !== null && multiplier) {
      const value = amount * multiplier.factor;
      return isSaneAmount(value) ? Math.round(value) : null;
    }
  }

  const grouped = /(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+)(?![.,]?\d)/i.exec(text);
  if (grouped) {
    const value = Number(grouped[1].replace(/[.,]/g, ""));
    if (isSaneAmount(value)) return value;
  }

  const plainWithRp = /rp\.?\s*(\d+)/i.exec(text);
  if (plainWithRp) {
    const value = Number(plainWithRp[1]);
    if (isSaneAmount(value)) return value;
  }

  const plain = /\b(\d{5,})\b/.exec(text);
  if (plain) {
    const value = Number(plain[1]);
    if (isSaneAmount(value)) return value;
  }

  return null;
}

function toNumber(raw: string): number | null {
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function isSaneAmount(value: number): boolean {
  return Number.isFinite(value) && value >= 10_000 && value <= 100_000_000_000;
}
