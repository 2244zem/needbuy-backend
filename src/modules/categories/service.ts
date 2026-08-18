import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import type { CreateCategoryInput, UpdateCategoryInput } from "./schema";

type CategoryNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children: CategoryNode[];
};

export async function collectCategoryWithDescendants(rootId: string): Promise<string[]> {
  const rows = await prisma.category.findMany({ select: { id: true, parentId: true } });
  return descendantIds(rows, rootId);
}

export function descendantIds(
  rows: { id: string; parentId: string | null }[],
  rootId: string
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parentId) continue;
    const siblings = childrenOf.get(row.parentId) ?? [];
    siblings.push(row.id);
    childrenOf.set(row.parentId, siblings);
  }

  const ids = [rootId];
  const queue = [rootId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const childId of childrenOf.get(current) ?? []) {
      ids.push(childId);
      queue.push(childId);
    }
  }
  return ids;
}

export async function listTree(): Promise<CategoryNode[]> {
  const rows = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true, parentId: true },
    orderBy: { name: "asc" },
  });

  const byId = new Map<string, CategoryNode>();
  rows.forEach((row) => byId.set(row.id, { ...row, children: [] }));

  const roots: CategoryNode[] = [];
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

export async function getBySlug(slug: string) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      parent: { select: { id: true, name: true, slug: true } },
      children: { select: { id: true, name: true, slug: true }, orderBy: { name: "asc" } },
    },
  });
  if (!category) throw AppError.notFound("Kategori nggak ketemu.");
  return category;
}

const adminSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  isActive: true,
  parentId: true,
  createdAt: true,
} as const;

export async function listAllForAdmin() {
  return prisma.category.findMany({
    select: { ...adminSelect, _count: { select: { products: true, children: true } } },
    orderBy: { name: "asc" },
  });
}

export async function createCategory(input: CreateCategoryInput) {
  if (input.parentId) await requireCategory(input.parentId, "Kategori induk nggak ketemu.");

  const slug = input.slug ?? slugify(input.name);
  await assertSlugAvailable(slug);

  return prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description ?? null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      parentId: input.parentId ?? null,
    },
    select: adminSelect,
  });
}

export async function updateCategory(categoryId: string, input: UpdateCategoryInput) {
  await requireCategory(categoryId);

  if (input.slug) await assertSlugAvailable(input.slug, categoryId);

  if (input.parentId !== undefined && input.parentId !== null) {
    await requireCategory(input.parentId, "Kategori induk nggak ketemu.");
    await assertNoCycle(categoryId, input.parentId);
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.slug !== undefined ? { slug: input.slug } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    },
    select: adminSelect,
  });
}

export async function deleteCategory(categoryId: string) {
  await requireCategory(categoryId);

  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId } }),
    prisma.category.count({ where: { parentId: categoryId } }),
  ]);

  if (productCount > 0) {
    throw AppError.conflict(
      `Kategori ini masih dipakai ${productCount} produk.`,
      "CATEGORY_HAS_PRODUCTS"
    );
  }
  if (childCount > 0) {
    throw AppError.conflict(
      `Kategori ini masih punya ${childCount} subkategori.`,
      "CATEGORY_HAS_CHILDREN"
    );
  }

  await prisma.category.delete({ where: { id: categoryId } });
  return { deleted: true };
}

async function requireCategory(categoryId: string, message = "Kategori nggak ketemu.") {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });
  if (!category) throw AppError.notFound(message);
  return category;
}

async function assertSlugAvailable(slug: string, exceptId?: string) {
  const clash = await prisma.category.findUnique({ where: { slug }, select: { id: true } });
  if (clash && clash.id !== exceptId) {
    throw AppError.conflict("Slug kategori udah dipakai.", "CATEGORY_SLUG_TAKEN");
  }
}

async function assertNoCycle(categoryId: string, proposedParentId: string) {
  if (categoryId === proposedParentId) {
    throw AppError.conflict(
      "Kategori nggak bisa menjadi induk dirinya sendiri.",
      "CATEGORY_CYCLE"
    );
  }

  const seen = new Set<string>([categoryId]);
  let cursor: string | null = proposedParentId;

  while (cursor) {
    if (seen.has(cursor)) {
      throw AppError.conflict(
        "Perubahan ini membuat siklus pada pohon kategori.",
        "CATEGORY_CYCLE"
      );
    }
    seen.add(cursor);

    const parent: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: cursor },
      select: { parentId: true },
    });
    cursor = parent?.parentId ?? null;
  }
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 160) || "kategori"
  );
}

const WORD_BOUNDARY_UNSAFE = /[.*+?^${}()|[\]\\]/g;

export function matchesAsWord(text: string, phrase: string): boolean {
  const cleaned = phrase.trim().toLowerCase();
  if (!cleaned) return false;
  const escaped = cleaned.replace(WORD_BOUNDARY_UNSAFE, "\\$&").replace(/\s+/g, "\\s+");
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i").test(text);
}

export async function findBySlugOrNull(
  slug: string
): Promise<{ id: string; slug: string } | null> {
  return prisma.category.findUnique({ where: { slug }, select: { id: true, slug: true } });
}

export async function findByKeyword(text: string): Promise<{ id: string; slug: string } | null> {
  const lowered = text.toLowerCase();
  const categories = await prisma.category.findMany({
    select: { id: true, slug: true, name: true },
  });

  const candidates = categories
    .map((category) => ({
      category,
      phrases: [category.name.toLowerCase(), category.slug.toLowerCase().replace(/-/g, " ")],
    }))
    .map(({ category, phrases }) => ({
      category,
      score: Math.max(0, ...phrases.filter((p) => matchesAsWord(lowered, p)).map((p) => p.length)),
    }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.category.slug.localeCompare(b.category.slug));

  const hit = candidates[0]?.category;
  return hit ? { id: hit.id, slug: hit.slug } : null;
}
