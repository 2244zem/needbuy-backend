import { compareSpecValues, normalizeSpecKey } from "./specBase";

export type Attribute = { attrKey: string; attrValue: string };
export type Requirement = { key: string; value: string };

export function normalizeKey(key: string): string {
  return normalizeSpecKey(key) ?? key.trim().toLowerCase();
}

export function normalizeValue(value: string): string {
  return value.trim().toLowerCase();
}

export function extractNumber(value: string): number | null {
  const match = /(\d+(?:[.,]\d+)?)/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function isRequirementSatisfied(
  requirement: Requirement,
  attributes: Attribute[]
): boolean {
  const wantedKey = normalizeKey(requirement.key);
  const matching = attributes.filter((attr) => normalizeKey(attr.attrKey) === wantedKey);
  if (matching.length === 0) return false;

  return matching.some((attr) => {
    const comparison = compareSpecValues(attr.attrValue, requirement.value);
    if (comparison !== null) return comparison >= 0;
    return normalizeValue(attr.attrValue) === normalizeValue(requirement.value);
  });
}

export function satisfiedRatio(requirements: Requirement[], attributes: Attribute[]): number {
  if (requirements.length === 0) return 1;
  const hits = requirements.filter((req) => isRequirementSatisfied(req, attributes)).length;
  return hits / requirements.length;
}

export function weightedSatisfiedRatio(
  preferences: { key: string; value: string; weight: number }[],
  attributes: Attribute[]
): number {
  if (preferences.length === 0) return 1;
  const totalWeight = preferences.reduce((sum, pref) => sum + pref.weight, 0);
  if (totalWeight <= 0) return 1;
  const hitWeight = preferences
    .filter((pref) => isRequirementSatisfied(pref, attributes))
    .reduce((sum, pref) => sum + pref.weight, 0);
  return hitWeight / totalWeight;
}
