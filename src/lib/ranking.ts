import type { ScoreComponents } from "./scoring";
import { LABEL_THRESHOLDS } from "./scoringWeights";

export type RecommendationLabel = "BEST_MATCH" | "GOOD_MATCH" | "ALTERNATIVE";

export function labelFor(matchScore: number): RecommendationLabel {
  if (matchScore >= LABEL_THRESHOLDS.bestMatch) return "BEST_MATCH";
  if (matchScore >= LABEL_THRESHOLDS.goodMatch) return "GOOD_MATCH";
  return "ALTERNATIVE";
}

const COMPONENT_LABELS: Record<keyof Omit<ScoreComponents, "matchScore">, string> = {
  categoryScore: "sesuai kategori kebutuhan",
  budgetScore: "cocok dengan budget",
  requirementScore: "memenuhi spesifikasi yang diminta",
  preferenceScore: "sesuai preferensi kamu",
  qualityScore: "rating produk tinggi",
  sellerScore: "rating penjual tinggi",
};

export function explanationFor(
  components: ScoreComponents,
  neutral: (keyof Omit<ScoreComponents, "matchScore">)[] = []
): string {
  const entries = (
    Object.keys(COMPONENT_LABELS) as (keyof Omit<ScoreComponents, "matchScore">)[]
  )
    .filter((key) => !neutral.includes(key))
    .map((key) => ({ key, value: components[key] }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 2);

  if (entries.length === 0) return "Alternatif yang masih memenuhi syarat wajib kamu.";

  const phrases = entries.map((entry) => COMPONENT_LABELS[entry.key]);
  const joined = phrases.length === 1 ? phrases[0] : `${phrases[0]} dan ${phrases[1]}`;
  return capitalize(joined) + ".";
}

export function rankAll<T extends { id: string; matchScore: number }>(
  items: T[]
): (T & { ranking: number; label: RecommendationLabel })[] {
  return [...items]
    .sort((a, b) => b.matchScore - a.matchScore || (a.id < b.id ? -1 : 1))
    .map((item, index) => ({
      ...item,
      ranking: index + 1,
      label: labelFor(item.matchScore),
    }));
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
