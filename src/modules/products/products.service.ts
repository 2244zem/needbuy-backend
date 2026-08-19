import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { collectCategoryWithDescendants } from "../categories/service";

import { requireOwnSeller } from "../sellers/service";
import type {
  AddAttributeInput,
  CreateProductInput,
  ListProductsQuery,
  UpdateImageInput,
  UpdateProductInput,
} from "./products.schema";

const listSelect = {
  id: true,
  name: true,
  slug: true,
  price: true,
  stock: true,
  discountPercent: true,
  bulkMinQty: true,
  bulkDiscountPercent: true,
  rating: true,
  soldCount: true,
  isActive: true,
  createdAt: true,
  category: { select: { id: true, name: true, slug: true } },
  seller: { select: { id: true, storeName: true, rating: true, status: true } },
  images: {
    select: { url: true, isPrimary: true, sortOrder: true },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    take: 1,
  },

  attributes: {
    where: { attrKey: "kondisi" },
    select: { attrValue: true },
    take: 1,
  },
} satisfies Prisma.ProductSelect;

export const DEFAULT_CONDITION = "Baru";

function withCondition<T extends { attributes: { attrValue: string }[] }>(product: T) {
  const { attributes, ...rest } = product;
  return { ...rest, condition: attributes[0]?.attrValue ?? DEFAULT_CONDITION };
}

const ORDER_BY: Record<ListProductsQuery["sort"], Prisma.ProductOrderByWithRelationInput> = {
  // Tanpa kata kunci tidak ada yang bisa diperingkat, jadi relevance sama
  // dengan newest. Dengan kata kunci, peringkatnya dihitung di rankByRelevance.
  relevance: { createdAt: "desc" },
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  rating: { rating: "desc" },
  sold: { soldCount: "desc" },
};

// ── Pencarian ────────────────────────────────────────────────────────────────
// Sebelumnya kata kunci dipakai utuh sebagai satu frasa, sehingga "laptop
// gaming murah" tidak pernah cocok dengan produk bernama "Laptop Gaming ASUS".
// Kata kunci sekarang dipecah dan setiap kata harus muncul di nama ATAU
// deskripsi, lalu hasilnya diperingkat menurut seberapa baik cocoknya.

const RELEVANCE_WINDOW = 300;

export function searchTerms(q: string): string[] {
  return [...new Set(q.toLowerCase().split(/\s+/).map((t) => t.trim()).filter((t) => t.length > 1))];
}

function searchWhere(q: string): Prisma.ProductWhereInput {
  const terms = searchTerms(q);
  if (terms.length === 0) {
    return {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  return {
    AND: terms.map((term) => ({
      OR: [
        { name: { contains: term, mode: "insensitive" } },
        { description: { contains: term, mode: "insensitive" } },
      ],
    })),
  };
}

// Nama jauh lebih menentukan daripada deskripsi: orang mengetik nama barang,
// bukan isi paragraf promosi. Cocok persis dan cocok di awal nama diberi
// bobot tertinggi supaya "laptop" tidak kalah oleh produk yang kebetulan
// menyebut "laptop" berkali-kali di deskripsi.
export function relevanceScore(product: { name: string; description: string | null; soldCount: number; rating: unknown }, q: string): number {
  const name = product.name.toLowerCase();
  const desc = (product.description ?? "").toLowerCase();
  const query = q.toLowerCase().trim();
  const terms = searchTerms(q);

  let score = 0;
  if (name === query) score += 1000;
  else if (name.startsWith(query)) score += 500;
  else if (name.includes(query)) score += 300;

  for (const term of terms) {
    if (name.includes(term)) score += 60;
    // Cocok di awal sebuah kata lebih berarti daripada kebetulan tersisip
    // di tengah kata lain: "top" di "laptop" jangan sekuat "top handle".
    if (name.split(/[^a-z0-9]+/i).some((word) => word.startsWith(term))) score += 40;
    if (desc.includes(term)) score += 8;
  }

  // Pemecah seri, bukan penentu: produk laris sedikit diunggulkan saat
  // kecocokannya setara.
  score += Math.min(product.soldCount, 100) / 20;
  return score;
}

async function rankByRelevance(
  where: Prisma.ProductWhereInput,
  q: string,
  skip: number,
  take: number
) {
  const candidates = await prisma.product.findMany({
    where,
    select: { ...listSelect, description: true },
    orderBy: { soldCount: "desc" },
    take: RELEVANCE_WINDOW,
  });
  const ranked = candidates
    .map((product) => ({ product, score: relevanceScore(product, q) }))
    .sort((a, b) => b.score - a.score)
    .map((row) => {
      const { description: _description, ...rest } = row.product;
      return rest;
    });
  return ranked.slice(skip, skip + take);
}

async function idsForCategorySlugs(slugs: string[]): Promise<string[]> {
  const roots = await prisma.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true },
  });
  const expanded = await Promise.all(
    roots.map((root) => collectCategoryWithDescendants(root.id))
  );
  return [...new Set(expanded.flat())];
}

function conditionWhere(conditions: string[]): Prisma.ProductWhereInput {
  const matchAttribute: Prisma.ProductWhereInput = {
    attributes: { some: { attrKey: "kondisi", attrValue: { in: conditions } } },
  };
  if (!conditions.includes(DEFAULT_CONDITION)) return matchAttribute;

  return {
    OR: [matchAttribute, { attributes: { none: { attrKey: "kondisi" } } }],
  };
}

export async function list(query: ListProductsQuery, categoryIds?: string[]) {
  const slugIds = query.categorySlugs?.length
    ? await idsForCategorySlugs(query.categorySlugs)
    : undefined;

  const scopedIds = categoryIds?.length ? categoryIds : slugIds;

  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(scopedIds
      ? { categoryId: { in: scopedIds } }
      : query.categoryId
        ? { categoryId: query.categoryId }
        : {}),

    ...(query.conditions?.length ? { AND: [conditionWhere(query.conditions)] } : {}),
    ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    ...(query.onSale ? { discountPercent: { gt: 0 } } : {}),
    ...(query.q ? searchWhere(query.q) : {}),
    ...(query.minPrice !== undefined || query.maxPrice !== undefined
      ? {
          price: {
            ...(query.minPrice !== undefined ? { gte: new Prisma.Decimal(query.minPrice) } : {}),
            ...(query.maxPrice !== undefined ? { lte: new Prisma.Decimal(query.maxPrice) } : {}),
          },
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query);
  const useRelevance = query.sort === "relevance" && Boolean(query.q);
  const [items, total] = await Promise.all([
    useRelevance
      ? rankByRelevance(where, query.q as string, skip, take)
      : prisma.product.findMany({ where, select: listSelect, orderBy: ORDER_BY[query.sort], skip, take }),
    prisma.product.count({ where }),
  ]);

  return { items: items.map(withCondition), meta: buildMeta(query, total) };
}

export async function getBySlug(slug: string, viewerId?: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: {
      ...listSelect,
      description: true,

      images: {
        select: { id: true, url: true, isPrimary: true, sortOrder: true },
        orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
      },
      attributes: { select: { id: true, attrKey: true, attrValue: true } },

      seller: {
        select: {
          id: true,
          storeName: true,
          rating: true,
          status: true,
          logoUrl: true,
          description: true,
          address: true,
          vacationMode: true,
          createdAt: true,
          _count: { select: { products: true, followers: true } },
        },
      },
      _count: { select: { reviews: true } },
    },
  });
  if (!product || !product.isActive) throw AppError.notFound("Produk nggak ketemu.");

  const following = viewerId
    ? (await prisma.sellerFollow.findUnique({
        where: { userId_sellerId: { userId: viewerId, sellerId: product.seller.id } },
        select: { id: true },
      })) !== null
    : false;

  return { ...product, seller: { ...product.seller, following } };
}

export async function listByCategorySlug(slug: string, query: ListProductsQuery) {
  const category = await prisma.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!category) throw AppError.notFound("Kategori nggak ketemu.");

  const categoryIds = await collectCategoryWithDescendants(category.id);
  return list(query, categoryIds);
}

export async function create(userId: string, input: CreateProductInput) {
  const seller = await requireOwnSeller(userId);

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw AppError.badRequest("Kategori nggak ketemu.", "CATEGORY_NOT_FOUND");

  const slug = await uniqueSlug(input.name);

  return prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: input.categoryId,
      name: input.name,
      slug,
      description: input.description ?? null,
      price: new Prisma.Decimal(input.price),
      stock: input.stock,
      ...(input.attributes?.length
        ? { attributes: { create: input.attributes.map((a) => ({ ...a })) } }
        : {}),
      ...(input.images?.length ? { images: { create: input.images.map((i) => ({ ...i })) } } : {}),
    },
    select: listSelect,
  });
}

export async function update(userId: string, productId: string, input: UpdateProductInput) {
  await assertOwnsProduct(userId, productId);

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw AppError.badRequest("Kategori nggak ketemu.", "CATEGORY_NOT_FOUND");
  }

  return prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
      ...(input.stock !== undefined ? { stock: input.stock } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: listSelect,
  });
}

export async function deactivate(userId: string, productId: string) {
  await assertOwnsProduct(userId, productId);
  await prisma.product.update({ where: { id: productId }, data: { isActive: false } });
  return { deactivated: true };
}

export async function replaceAttributes(
  userId: string,
  productId: string,
  attributes: { attrKey: string; attrValue: string }[]
) {
  await assertOwnsProduct(userId, productId);

  return prisma.$transaction(async (tx) => {
    await tx.productAttribute.deleteMany({ where: { productId } });
    if (attributes.length) {
      await tx.productAttribute.createMany({
        data: attributes.map((a) => ({ productId, attrKey: a.attrKey, attrValue: a.attrValue })),
      });
    }
    return tx.productAttribute.findMany({
      where: { productId },
      select: { id: true, attrKey: true, attrValue: true },
    });
  });
}

export async function addImages(
  userId: string,
  productId: string,
  images: { url: string; isPrimary: boolean; sortOrder: number }[]
) {
  await assertOwnsProduct(userId, productId);

  return prisma.$transaction(async (tx) => {
    if (images.some((image) => image.isPrimary)) {
      await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    }
    await tx.productImage.createMany({ data: images.map((image) => ({ productId, ...image })) });
    return tx.productImage.findMany({
      where: { productId },
      select: { id: true, url: true, isPrimary: true, sortOrder: true },
      orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
    });
  });
}

export async function updateImage(
  userId: string,
  productId: string,
  imageId: string,
  input: UpdateImageInput
) {
  await assertOwnsProduct(userId, productId);

  return prisma.$transaction(async (tx) => {
    const image = await tx.productImage.findFirst({
      where: { id: imageId, productId },
      select: { id: true },
    });
    if (!image) throw AppError.notFound("Gambar produk nggak ketemu.");
    if (input.isPrimary === true) {
      await tx.productImage.updateMany({ where: { productId }, data: { isPrimary: false } });
    }

    return tx.productImage.update({
      where: { id: imageId },
      data: {
        ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
      select: { id: true, url: true, isPrimary: true, sortOrder: true },
    });
  });
}

export async function removeImage(userId: string, productId: string, imageId: string) {
  await assertOwnsProduct(userId, productId);

  const deleted = await prisma.productImage.deleteMany({ where: { id: imageId, productId } });
  if (deleted.count === 0) throw AppError.notFound("Gambar produk nggak ketemu.");
  return { deleted: true };
}

export async function addAttribute(userId: string, productId: string, input: AddAttributeInput) {
  await assertOwnsProduct(userId, productId);

  const attrKey = input.attrKey.trim().toLowerCase();

  const duplicate = await prisma.productAttribute.findFirst({
    where: { productId, attrKey, attrValue: input.attrValue },
    select: { id: true },
  });
  if (duplicate) {
    throw AppError.conflict("Atribut dengan nilai yang sama udah ada.", "ATTRIBUTE_DUPLICATE");
  }

  return prisma.productAttribute.create({
    data: { productId, attrKey, attrValue: input.attrValue },
    select: { id: true, attrKey: true, attrValue: true },
  });
}

export async function removeAttribute(userId: string, productId: string, attributeId: string) {
  await assertOwnsProduct(userId, productId);

  const deleted = await prisma.productAttribute.deleteMany({
    where: { id: attributeId, productId },
  });
  if (deleted.count === 0) throw AppError.notFound("Atribut produk nggak ketemu.");
  return { deleted: true };
}
async function assertOwnsProduct(userId: string, productId: string) {
  const seller = await requireOwnSeller(userId);
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true },
  });
  if (!product) throw AppError.notFound("Produk nggak ketemu.");
  if (product.sellerId !== seller.id) {
    throw AppError.forbidden("Produk ini bukan milik toko kamu.");
  }
  return product;
}

async function uniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "produk";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function recordView(productId: string, userId?: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, sellerId: true, isActive: true },
  });
  if (!product || !product.isActive) throw AppError.notFound("Produk nggak ketemu.");

  await prisma.productView.create({
    data: { productId: product.id, sellerId: product.sellerId, userId: userId ?? null },
  });

  return { recorded: true };
}

export async function listAllForAdmin(query: {
  isActive?: boolean;
  categoryId?: string;
  sellerId?: string;
  q?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.ProductWhereInput = {
    ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.sellerId ? { sellerId: query.sellerId } : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { sku: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        stock: true,
        isActive: true,
        createdAt: true,
        category: { select: { id: true, name: true } },
        seller: { select: { id: true, storeName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function setActiveAsAdmin(productId: string, isActive: boolean) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });
  if (!product) throw AppError.notFound("Produk nggak ketemu.");

  if (product.isActive === isActive) return { changed: false, isActive };

  await prisma.product.update({ where: { id: productId }, data: { isActive } });
  return { changed: true, isActive };
}
