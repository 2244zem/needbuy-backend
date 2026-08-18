import { isRequirementSatisfied, type Attribute } from "./attributeMatch";
import { BUDGET_TOLERANCE } from "./scoringWeights";

export function passesStockAndBudget(
  candidate: { stock: number; price: number },
  budget: number | null
): boolean {
  if (candidate.stock <= 0) return false;
  
  if (budget === null) return true;
  return candidate.price <= budget * (1 + BUDGET_TOLERANCE);
}

export function passesHardRequirements(
  candidate: { attributes: Attribute[] },
  hardRequirements: { key: string; value: string }[]
): boolean {
  return hardRequirements.every((req) => isRequirementSatisfied(req, candidate.attributes));
}

export function filterCandidates<
  T extends { stock: number; price: number; attributes: Attribute[] }
>(
  candidates: T[],
  need: { budget: number | null; hardRequirements: { key: string; value: string }[] }
): T[] {
  return candidates
    .filter((candidate) => passesStockAndBudget(candidate, need.budget))
    .filter((candidate) => passesHardRequirements(candidate, need.hardRequirements));
}
