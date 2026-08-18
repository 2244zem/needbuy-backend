import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { requireOwnSeller } from "../sellers/service";
import type { CreateInventInput, ListInventQuery, UpdateInventInput } from "./schema";

const inventSelect = {
  id: true,
  sellerId: true,
  categoryId: true,
  sku: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  stock: true,
  isActive: true,
  discountPercent: true,
  bulkMinQty: true,
  bulkDiscountPercent: true,
  rating: true,
  soldCount: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true } },

  images: {
    select: { id: true, url: true, isPrimary: true, sortOrder: true },
    orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
  },
  attributes: { select: { id: true, attrKey: true, attrValue: true } },
} satisfies Prisma.ProductSelect;

function toImageRows(images: NonNullable<CreateInventInput["images"]>) {
  const hasPrimary = images.some((image) => image.isPrimary);
  return images.map((image, index) => ({
    url: image.url,
    isPrimary: hasPrimary ? image.isPrimary : index === 0,
    sortOrder: image.sortOrder ?? index,
  }));
}

export async function stats(userId: string) {
  const seller = await requireOwnSeller(userId);
  const mine = { sellerId: seller.id };

  const [total, drafts, outOfStock, active] = await Promise.all([
    prisma.product.count({ where: mine }),
    prisma.product.count({ where: { ...mine, isActive: false } }),
    prisma.product.count({ where: { ...mine, isActive: true, stock: 0 } }),
    prisma.product.count({ where: { ...mine, isActive: true, stock: { gt: 0 } } }),
  ]);

  return { total, active, outOfStock, drafts };
}

export async function list(userId: string, query: ListInventQuery) {
  const seller = await requireOwnSeller(userId);

  const where: Prisma.ProductWhereInput = {
    sellerId: seller.id,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status === "ACTIVE"
      ? { isActive: true }
      : query.status === "INACTIVE"
      ? { isActive: false }
      : {}),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { sku: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: inventSelect,
      orderBy: { [query.sortBy ?? "createdAt"]: query.order },
      skip,
      take,
    }),
    prisma.product.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function getById(userId: string, id: string) {
  const seller = await requireOwnSeller(userId);
  const product = await prisma.product.findUnique({
    where: { id },
    select: inventSelect,
  });

  if (!product) throw AppError.notFound("Produk inventori nggak ketemu.");
  if (product.sellerId !== seller.id) {
    throw AppError.forbidden("Produk inventori ini bukan milik toko kamu.");
  }

  return product;
}

export async function create(userId: string, input: CreateInventInput) {
  const seller = await requireOwnSeller(userId);

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw AppError.badRequest("Kategori nggak ketemu.", "CATEGORY_NOT_FOUND");

  const generatedSku =
    input.sku ||
    `SKU-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

  if (input.sku) {
    const existingSku = await prisma.product.findFirst({ where: { sku: input.sku } });
    if (existingSku) {
      throw AppError.badRequest("SKU udah digunakan oleh produk lain.", "SKU_ALREADY_EXISTS");
    }
  }

  const slug = await generateUniqueSlug(input.name);

  return prisma.product.create({
    data: {
      sellerId: seller.id,
      categoryId: input.categoryId,
      sku: generatedSku,
      name: input.name,
      slug,
      description: input.description ?? null,
      price: new Prisma.Decimal(input.price),
      stock: input.stock,
      isActive: input.isActive ?? true,
      discountPercent: input.discountPercent ?? 0,
      bulkMinQty: input.bulkMinQty ?? null,
      bulkDiscountPercent: input.bulkDiscountPercent ?? null,
      ...(input.images?.length ? { images: { create: toImageRows(input.images) } } : {}),
      ...(input.attributes?.length ? { attributes: { create: input.attributes } } : {}),
    },
    select: inventSelect,
  });
}

export async function update(userId: string, id: string, input: UpdateInventInput) {
  const seller = await requireOwnSeller(userId);
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, sellerId: true, sku: true },
  });

  if (!existing) throw AppError.notFound("Produk inventori nggak ketemu.");
  if (existing.sellerId !== seller.id) {
    throw AppError.forbidden("Produk inventori ini bukan milik toko kamu.");
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw AppError.badRequest("Kategori nggak ketemu.", "CATEGORY_NOT_FOUND");
  }

  if (input.sku && input.sku !== existing.sku) {
    const duplicateSku = await prisma.product.findFirst({ where: { sku: input.sku } });
    if (duplicateSku) {
      throw AppError.badRequest("SKU udah digunakan oleh produk lain.", "SKU_ALREADY_EXISTS");
    }
  }

  return prisma.$transaction(async (tx) => {
    if (input.images !== undefined) {
      await tx.productImage.deleteMany({ where: { productId: id } });
      if (input.images.length > 0) {
        await tx.productImage.createMany({
          data: toImageRows(input.images).map((image) => ({ productId: id, ...image })),
        });
      }
    }

    if (input.attributes !== undefined) {
      await tx.productAttribute.deleteMany({ where: { productId: id } });
      if (input.attributes.length > 0) {
        await tx.productAttribute.createMany({
          data: input.attributes.map((attribute) => ({ productId: id, ...attribute })),
        });
      }
    }

    return tx.product.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sku !== undefined ? { sku: input.sku } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.price !== undefined ? { price: new Prisma.Decimal(input.price) } : {}),
        ...(input.stock !== undefined ? { stock: input.stock } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.discountPercent !== undefined ? { discountPercent: input.discountPercent } : {}),
        ...(input.bulkMinQty !== undefined ? { bulkMinQty: input.bulkMinQty } : {}),
        ...(input.bulkDiscountPercent !== undefined
          ? { bulkDiscountPercent: input.bulkDiscountPercent }
          : {}),
      },
      select: inventSelect,
    });
  });
}

export async function remove(userId: string, id: string) {
  const seller = await requireOwnSeller(userId);
  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, sellerId: true },
  });

  if (!existing) throw AppError.notFound("Produk inventori nggak ketemu.");
  if (existing.sellerId !== seller.id) {
    throw AppError.forbidden("Produk inventori ini bukan milik toko kamu.");
  }

  const orderedCount = await prisma.orderItem.count({ where: { productId: id } });
  if (orderedCount > 0) {
    throw AppError.conflict(
      "Produk ini udah pernah dipesan sehingga nggak bisa dihapus. Nonaktifkan saja (jadikan Draft) supaya hilang dari toko tanpa merusak riwayat order.",
      "PRODUCT_HAS_ORDERS"
    );
  }

  await prisma.product.delete({ where: { id } });
  return { deleted: true, id };
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 180) || "invent";

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const clash = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}