import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { SELF_REVIEW_MESSAGE } from "../../lib/selfPurchase";
import { assertNotOwnStore } from "../sellers/service";

export async function createReview(
  userId: string,
  orderId: string,
  orderItemId: string,
  input: { rating: number; comment?: string; media?: { url: string; kind: "IMAGE" | "VIDEO" }[] }
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, userId },
      select: { id: true, status: true, sellerId: true },
    });
    if (!order) throw AppError.notFound("Order nggak ketemu.");

    await assertNotOwnStore(userId, [order.sellerId], tx, SELF_REVIEW_MESSAGE);

    if (order.status !== "COMPLETED") {
      throw AppError.conflict(
        "Review hanya bisa dibuat setelah order berstatus COMPLETED.",
        "ORDER_NOT_COMPLETED"
      );
    }

    const item = await tx.orderItem.findFirst({
      where: { id: orderItemId, orderId },
      select: { id: true, productId: true, review: { select: { id: true } } },
    });
    if (!item) throw AppError.notFound("Item order nggak ketemu.");
    if (item.review) {
      throw AppError.conflict("Item ini udah pernah direview.", "ALREADY_REVIEWED");
    }

    const review = await tx.review.create({
      data: {
        orderItemId: item.id,
        userId,
        productId: item.productId,
        rating: input.rating,
        comment: input.comment ?? null,
        
        ...(input.media?.length
          ? {
              media: {
                create: input.media.map((file, index) => ({
                  url: file.url,
                  kind: file.kind,
                  sortOrder: index,
                })),
              },
            }
          : {}),
      },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        media: { select: { id: true, url: true, kind: true }, orderBy: { sortOrder: "asc" } },
      },
    });

    await recalcRatings(tx, item.productId, order.sellerId);

    return review;
  });
}

async function recalcRatings(
  tx: Prisma.TransactionClient,
  productId: string,
  sellerId: string
) {
  const productAgg = await tx.review.aggregate({
    where: { productId, isHidden: false },
    _avg: { rating: true },
  });
  await tx.product.update({
    where: { id: productId },
    data: { rating: new Prisma.Decimal(productAgg._avg.rating ?? 0) },
  });

  const sellerAgg = await tx.review.aggregate({
    where: { product: { sellerId }, isHidden: false },
    _avg: { rating: true },
  });
  await tx.seller.update({
    where: { id: sellerId },
    data: { rating: new Prisma.Decimal(sellerAgg._avg.rating ?? 0) },
  });
}

export async function listForProduct(productId: string, query: { page: number; limit: number }) {
  const { skip, take } = toSkipTake(query);
  
  const where = { productId, isHidden: false };

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        user: { select: { name: true } },
        media: { select: { id: true, url: true, kind: true }, orderBy: { sortOrder: "asc" } },
        
        orderItem: { select: { variant: true } },
      },
    }),
    prisma.review.count({ where }),
  ]);

  const groups = await prisma.review.groupBy({
    by: ["rating"],
    where,
    _count: { rating: true },
  });
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: groups.find((group) => group.rating === star)?._count.rating ?? 0,
  }));
  const average =
    total === 0
      ? 0
      : Number(
          (
            breakdown.reduce((sum, row) => sum + row.star * row.count, 0) / total
          ).toFixed(2)
        );

  return { items, meta: { ...buildMeta(query, total), average, breakdown } };
}

export async function listAllForAdmin(query: {
  isHidden?: boolean;
  rating?: number;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.isHidden !== undefined ? { isHidden: query.isHidden } : {}),
    ...(query.rating ? { rating: query.rating } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        rating: true,
        comment: true,
        isHidden: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            name: true,
            category: { select: { name: true } },
            seller: { select: { storeName: true } },
          },
        },
      },
    }),
    prisma.review.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function setHidden(reviewId: string, isHidden: boolean) {
  return prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({
      where: { id: reviewId },
      select: {
        id: true,
        isHidden: true,
        productId: true,
        product: { select: { sellerId: true } },
      },
    });
    if (!review) throw AppError.notFound("Ulasan nggak ketemu.");
    if (review.isHidden === isHidden) return { changed: false, isHidden };

    await tx.review.update({ where: { id: reviewId }, data: { isHidden } });
    await recalcRatings(tx, review.productId, review.product.sellerId);

    return { changed: true, isHidden };
  });
}
