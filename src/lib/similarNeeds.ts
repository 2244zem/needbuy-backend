import { tokenize } from "./needParsing";

export type NeedLike = { id: string; goal?: string | null; rawInput?: string | null };
export type SimilarNeed = { id: string; score: number };

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function needTokens(need: NeedLike): Set<string> {
  return new Set(tokenize(`${need.goal ?? ""} ${need.rawInput ?? ""}`));
}

export function findSimilarNeeds(
  needId: string,
  needs: NeedLike[],
  limit = 5
): SimilarNeed[] {
  const target = needs.find((n) => n.id === needId);
  if (!target) return [];

  const targetTokens = needTokens(target);

  return needs
    .filter((n) => n.id !== needId)
    .map((n) => ({ id: n.id, score: jaccard(targetTokens, needTokens(n)) }))
    .filter((n) => n.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(limit, 0));
}
