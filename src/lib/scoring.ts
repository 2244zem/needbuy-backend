import { satisfiedRatio, weightedSatisfiedRatio, type Attribute } from "./attributeMatch";
import { BUDGET_TOLERANCE, SCORING_WEIGHTS } from "./scoringWeights";

export type ScoreComponents = {
  categoryScore: number;
  budgetScore: number;
  requirementScore: number;
  preferenceScore: number;
  qualityScore: number;
  sellerScore: number;
  matchScore: number;
};

export type ScoringCandidate = {
  price: number;
  rating: number;
  categoryId: string;
  attributes: Attribute[];
  seller: { rating: number; status: "ACTIVE" | "SUSPENDED" };
};

export type ScoringNeed = {
  categoryId: string | null;
  budget: number | null;
  
  softRequirements: { key: string; value: string }[];
  preferences: { key: string; value: string; weight: number }[];
};

const MAX_RATING = 5;

export function categoryScore(candidateCategoryId: string, needCategoryId: string | null): number {
  if (!needCategoryId) return 100;
  return candidateCategoryId === needCategoryId ? 100 : 60;
}

export function budgetScore(price: number, budget: number | null): number {
  if (budget === null || budget <= 0) return 100;
  if (price <= budget) return 100;
  const ceiling = budget * (1 + BUDGET_TOLERANCE);
  if (price >= ceiling) return 0;
  return round2(((ceiling - price) / (ceiling - budget)) * 100);
}

export function qualityScore(rating: number): number {
  return clamp(round2((rating / MAX_RATING) * 100));
}

export function sellerScore(rating: number, status: "ACTIVE" | "SUSPENDED"): number {
  if (status === "SUSPENDED") return 0;
  return clamp(round2((rating / MAX_RATING) * 100));
}

export function score(candidate: ScoringCandidate, need: ScoringNeed): ScoreComponents {
  const components = {
    categoryScore: categoryScore(candidate.categoryId, need.categoryId),
    budgetScore: budgetScore(candidate.price, need.budget),
    
    requirementScore: round2(satisfiedRatio(need.softRequirements, candidate.attributes) * 100),
    preferenceScore: round2(weightedSatisfiedRatio(need.preferences, candidate.attributes) * 100),
    qualityScore: qualityScore(candidate.rating),
    sellerScore: sellerScore(candidate.seller.rating, candidate.seller.status),
  };

  const matchScore = round2(
    components.categoryScore * SCORING_WEIGHTS.category +
      components.budgetScore * SCORING_WEIGHTS.budget +
      components.requirementScore * SCORING_WEIGHTS.requirement +
      components.preferenceScore * SCORING_WEIGHTS.preference +
      components.qualityScore * SCORING_WEIGHTS.quality +
      components.sellerScore * SCORING_WEIGHTS.seller
  );

  return { ...components, matchScore: clamp(matchScore) };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(Math.max(value, 0), 100);
}
