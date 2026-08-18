import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { explanationFor, rankAll } from "../../lib/ranking";
import { score, type ScoreComponents } from "../../lib/scoring";
import { findMatchingProducts, type Candidate, type MatchingNeed } from "./matching.service";

export type NeedForScoring = MatchingNeed & {
  softRequirements: { key: string; value: string }[];
  preferences: { key: string; value: string; weight: number }[];
};

export async function generateRecommendations(needId: string, need: NeedForScoring) {
  const candidates = await findMatchingProducts(need);

  const scored = candidates.map((candidate) => ({
    id: candidate.id,
    candidate,
    components: score(toScoringCandidate(candidate), {
      categoryId: need.categoryId,
      budget: need.budget,
      softRequirements: need.softRequirements,
      preferences: need.preferences,
    }),
  }));

  const neutral: (keyof Omit<ScoreComponents, "matchScore">)[] = [];
  if (need.softRequirements.length === 0) neutral.push("requirementScore");
  if (need.preferences.length === 0) neutral.push("preferenceScore");
  if (need.budget === null) neutral.push("budgetScore");
  if (need.categoryId === null) neutral.push("categoryScore");

  const ranked = rankAll(scored.map((item) => ({ ...item, matchScore: item.components.matchScore })));

  const rows = ranked.map((item) => ({
    needId,
    productId: item.candidate.id,
    matchScore: new Prisma.Decimal(item.components.matchScore),
    categoryScore: new Prisma.Decimal(item.components.categoryScore),
    budgetScore: new Prisma.Decimal(item.components.budgetScore),
    requirementScore: new Prisma.Decimal(item.components.requirementScore),
    preferenceScore: new Prisma.Decimal(item.components.preferenceScore),
    qualityScore: new Prisma.Decimal(item.components.qualityScore),
    sellerScore: new Prisma.Decimal(item.components.sellerScore),
    label: item.label,
    ranking: item.ranking,
    explanation: explanationFor(item.components, neutral),
  }));

  await prisma.$transaction(async (tx) => {
    await tx.recommendation.deleteMany({ where: { needId } });
    if (rows.length) await tx.recommendation.createMany({ data: rows });
    await tx.need.update({ where: { id: needId }, data: { status: "COMPLETED" } });
  });

  return { total: rows.length, evaluated: candidates.length };
}

export async function listForNeed(needId: string, query: { page: number; limit: number }) {
  const { skip, take } = toSkipTake(query);
  const where = { needId };

  const [items, total] = await Promise.all([
    prisma.recommendation.findMany({
      where,
      skip,
      take,
      orderBy: { ranking: "asc" },
      select: {
        id: true,
        matchScore: true,
        categoryScore: true,
        budgetScore: true,
        requirementScore: true,
        preferenceScore: true,
        qualityScore: true,
        sellerScore: true,
        label: true,
        ranking: true,
        explanation: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            stock: true,
            rating: true,
            seller: { select: { id: true, storeName: true, rating: true } },
            images: {
              select: { url: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
            },
          },
        },
      },
    }),
    prisma.recommendation.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function cheaperAlternatives(needId: string, maxPrice: number, limit = 10) {
  return prisma.recommendation.findMany({
    where: { needId, product: { price: { lt: new Prisma.Decimal(maxPrice) }, isActive: true, stock: { gt: 0 } } },
    orderBy: { ranking: "asc" },
    take: limit,
    select: {
      id: true,
      matchScore: true,
      label: true,
      ranking: true,
      explanation: true,
      product: {
        select: { id: true, name: true, slug: true, price: true, stock: true, rating: true },
      },
    },
  });
}

function toScoringCandidate(candidate: Candidate) {
  return {
    price: candidate.price,
    rating: candidate.rating,
    categoryId: candidate.categoryId,
    attributes: candidate.attributes,
    seller: { rating: candidate.seller.rating, status: candidate.seller.status },
  };
}
