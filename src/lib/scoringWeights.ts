export const SCORING_WEIGHTS = {
  category: 0.15,
  budget: 0.2,
  requirement: 0.2,
  preference: 0.2,
  quality: 0.15,
  seller: 0.1,
} as const;

export type ScoringWeights = typeof SCORING_WEIGHTS;

export const WEIGHT_SUM = Object.values(SCORING_WEIGHTS).reduce((a, b) => a + b, 0);

if (Math.abs(WEIGHT_SUM - 1) > 1e-9) {
  throw new Error(
    `SCORING_WEIGHTS harus berjumlah 1.0, sekarang ${WEIGHT_SUM}. Perbaiki src/lib/scoringWeights.ts.`
  );
}

export const BUDGET_TOLERANCE = 0.15;

export const LABEL_THRESHOLDS = { bestMatch: 85, goodMatch: 70 } as const;
