import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";

export async function list(userId: string, query: { page: number; limit: number }) {
  const { skip, take } = toSkipTake(query);
  const where = { userId };

  const [items, total] = await Promise.all([
    prisma.savedProduct.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            price: true,
            stock: true,
            rating: true,
            isActive: true,
            images: {
              select: { url: true },
              orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
              take: 1,
            },
          },
        },
      },
    }),
    prisma.savedProduct.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function save(userId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true },
  });
  if (!product) throw AppError.notFound("Produk nggak ketemu.");

  return prisma.savedProduct.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
    select: { id: true, productId: true, createdAt: true },
  });
}

export async function remove(userId: string, productId: string) {
  const deleted = await prisma.savedProduct.deleteMany({ where: { userId, productId } });
  if (deleted.count === 0) throw AppError.notFound("Produk ini nggak ada di daftar simpanan kamu.");
  return { deleted: true };
}
