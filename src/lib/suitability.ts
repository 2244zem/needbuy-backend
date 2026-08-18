import { isRequirementSatisfied, normalizeKey, type Attribute } from "./attributeMatch";

export type SuitabilityRequirement = { key: string; value: string; isHard?: boolean };
export type SuitabilityPreference = { key: string; value: string };

export type MatchedSpec = { key: string; required: string; actual: string };
export type MissedSpec = { key: string; required: string; reason: string; actual: string[] };

export type SuitabilityVerdict = "MATCH" | "PARTIAL" | "MISMATCH";

export type SuitabilityReport = {
  productName: string;
  verdict: SuitabilityVerdict;
  score: number;
  hardRequirementsTotal: number;
  hardRequirementsMet: boolean | null;
  matched: MatchedSpec[];
  missed: MissedSpec[];
  preferencesMatched: number;
  preferencesMissed: SuitabilityPreference[];
  summary: string;
};

const MATCH_THRESHOLD = 80;
const PARTIAL_THRESHOLD = 40;

export function checkSuitability(
  product: { name?: string | null; attributes?: Attribute[] | null },
  requirements: SuitabilityRequirement[] = [],
  preferences: SuitabilityPreference[] = []
): SuitabilityReport {
  const productName = (product.name ?? "").trim() || "Produk ini";
  const attributes = product.attributes ?? [];

  const byKey = new Map<string, string[]>();
  for (const attr of attributes) {
    const key = normalizeKey(attr.attrKey ?? "");
    const value = (attr.attrValue ?? "").trim();
    if (!key || !value) continue;
    byKey.set(key, [...(byKey.get(key) ?? []), value]);
  }

  const matched: MatchedSpec[] = [];
  const missed: MissedSpec[] = [];
  let hardTotal = 0;
  let hardMet = 0;

  for (const req of requirements) {
    const key = normalizeKey(req.key ?? "");
    if (!key) continue;
    if (req.isHard) hardTotal++;

    const actuals = byKey.get(key) ?? [];
    if (isRequirementSatisfied({ key: req.key, value: req.value }, attributes)) {
      if (req.isHard) hardMet++;
      matched.push({ key, required: req.value, actual: actuals[0] ?? req.value });
    } else {
      missed.push({
        key,
        required: req.value,
        reason: actuals.length
          ? "nilai produk nggak memenuhi kebutuhan"
          : "spesifikasi nggak tertera pada produk",
        actual: actuals,
      });
    }
  }

  const preferencesMissed: SuitabilityPreference[] = [];
  let preferencesMatched = 0;
  for (const pref of preferences) {
    if (!normalizeKey(pref.key ?? "")) continue;
    if (isRequirementSatisfied({ key: pref.key, value: pref.value }, attributes)) {
      preferencesMatched++;
    } else {
      preferencesMissed.push(pref);
    }
  }

  const considered = matched.length + missed.length;
  const score = considered === 0 ? 100 : Math.round((matched.length / considered) * 100);

  const allHardMet = hardTotal === 0 || hardMet === hardTotal;

  const verdict: SuitabilityVerdict = !allHardMet
    ? "MISMATCH"
    : score >= MATCH_THRESHOLD
      ? "MATCH"
      : score >= PARTIAL_THRESHOLD
        ? "PARTIAL"
        : "MISMATCH";

  return {
    productName,
    verdict,
    score,
    hardRequirementsTotal: hardTotal,
    hardRequirementsMet: hardTotal === 0 ? null : allHardMet,
    matched,
    missed,
    preferencesMatched,
    preferencesMissed,
    summary: summarize(verdict, score, productName, matched, missed),
  };
}

function summarize(
  verdict: SuitabilityVerdict,
  score: number,
  productName: string,
  matched: MatchedSpec[],
  missed: MissedSpec[]
): string {
  if (verdict === "MATCH") {
    return `${productName} memenuhi kebutuhanmu (${score}/100).`;
  }
  if (verdict === "PARTIAL") {
    return `${productName} hanya cocok sebagian (${score}/100): ${matched.length} spesifikasi cocok, ${missed.length} belum terpenuhi.`;
  }
  const kurang = missed.filter((m) => m.actual.length > 0).length;
  if (kurang > 0) {
    return `${productName} belum memenuhi kebutuhanmu, ${kurang} spesifikasi nilainya di bawah yang kamu minta.`;
  }
  return `${productName} nggak cocok sama kebutuhanmu: ${missed.length} spesifikasi penting nggak tertera atau nggak terpenuhi.`;
}
