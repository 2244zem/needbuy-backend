import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import type { Attribute } from "../../lib/attributeMatch";
import { filterCandidates } from "../../lib/matchFilters";
import { BUDGET_TOLERANCE } from "../../lib/scoringWeights";
import { collectCategoryWithDescendants } from "../categories/service";

export {
  filterCandidates,
  passesHardRequirements,
  passesStockAndBudget,
} from "../../lib/matchFilters";

export type Candidate = {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock: number;
  rating: number;
  categoryId: string;
  attributes: Attribute[];
  seller: { id: string; rating: number; status: "ACTIVE" | "SUSPENDED" };
};

export type MatchingNeed = {
  categoryId: string | null;
  budget: number | null;
  hardRequirements: { key: string; value: string }[];
  
  keywords?: string[];
};

export async function loadCandidates(need: MatchingNeed): Promise<Candidate[]> {
  const categoryIds = need.categoryId
    ? await collectCategoryWithDescendants(need.categoryId)
    : null;

  const keywords = (need.keywords ?? []).filter((word) => word.length > 2).slice(0, 6);

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    stock: { gt: 0 },
    ...(categoryIds ? { categoryId: { in: categoryIds } } : {}),
    
    ...(!categoryIds && keywords.length
      ? {
          OR: keywords.flatMap((word) => [
            { name: { contains: word, mode: "insensitive" as const } },
            { description: { contains: word, mode: "insensitive" as const } },
          ]),
        }
      : {}),
    
    ...(need.budget !== null
      ? { price: { lte: new Prisma.Decimal(need.budget * (1 + BUDGET_TOLERANCE)) } }
      : {}),
  };

  const rows = await prisma.product.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      stock: true,
      rating: true,
      categoryId: true,
      attributes: { select: { attrKey: true, attrValue: true } },
      seller: { select: { id: true, rating: true, status: true } },
    },
    
    take: 500,
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    price: Number(row.price),
    stock: row.stock,
    rating: Number(row.rating),
    categoryId: row.categoryId,
    attributes: row.attributes,
    seller: {
      id: row.seller.id,
      rating: Number(row.seller.rating),
      status: row.seller.status,
    },
  }));
}

export async function findMatchingProducts(need: MatchingNeed): Promise<Candidate[]> {
  const candidates = await loadCandidates(need);
  return filterCandidates(candidates, need);
}
