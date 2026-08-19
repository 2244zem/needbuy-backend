import { Prisma, type PlanStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { computePlanTotals } from "../../lib/planTotals";
import { addItem as addCartItem } from "../cart/service";
import { cheaperAlternatives } from "../recommendations/ranking.service";
import type { CreatePlanInput, UpdatePlanInput } from "./schema";

const planSelect = {
  id: true,
  needId: true,
  name: true,
  budget: true,
  total: true,
  remaining: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: {
      id: true,
      quantity: true,
      priceAtAdd: true,
      subtotal: true,
      isReplaced: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stock: true,
          isActive: true,
          category: { select: { id: true, name: true, slug: true } },
          images: { select: { url: true, isPrimary: true, sortOrder: true } },
          seller: { select: { id: true, storeName: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
} satisfies Prisma.ShoppingPlanSelect;

export { computePlanTotals } from "../../lib/planTotals";

async function recalculate(tx: Prisma.TransactionClient, planId: string) {
  const plan = await tx.shoppingPlan.findUnique({
    where: { id: planId },
    select: { id: true, budget: true, items: { select: { subtotal: true } } },
  });
  if (!plan) throw AppError.notFound("Shopping plan nggak ketemu.");

  const { total, remaining, status } = computePlanTotals(plan.items, plan.budget);
  return tx.shoppingPlan.update({
    where: { id: planId },
    data: { total, remaining, status },
    select: planSelect,
  });
}

export async function createPlan(userId: string, input: CreatePlanInput) {
  if (input.needId) {
    const need = await prisma.need.findFirst({
      where: { id: input.needId, userId },
      select: { id: true },
    });
    if (!need) throw AppError.notFound("Need nggak ketemu.");
  }

  const budget = new Prisma.Decimal(input.budget);

  return prisma.$transaction(async (tx) => {
    const plan = await tx.shoppingPlan.create({
      data: {
        userId,
        needId: input.needId ?? null,
        name: input.name ?? null,
        budget,
        total: 0,
        remaining: budget,
        status: "DRAFT",
      },
      select: { id: true },
    });

    if (input.fromRecommendations && input.needId) {
      const recommendations = await tx.recommendation.findMany({
        where: { needId: input.needId, product: { isActive: true, stock: { gt: 0 } } },
        orderBy: { ranking: "asc" },
        take: input.maxItems,
        select: { product: { select: { id: true, price: true } } },
      });

      if (recommendations.length) {
        await tx.shoppingPlanItem.createMany({
          data: recommendations.map((rec) => ({
            shoppingPlanId: plan.id,
            productId: rec.product.id,
            quantity: 1,
            priceAtAdd: rec.product.price,
            subtotal: rec.product.price,
          })),
        });
      }
    }

    return recalculate(tx, plan.id);
  });
}

export async function listPlans(
  userId: string,
  query: { status?: PlanStatus; page: number; limit: number }
) {
  const where = { userId, ...(query.status ? { status: query.status } : {}) };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.shoppingPlan.findMany({
      where,
      select: { ...planSelect, items: false, _count: { select: { items: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.shoppingPlan.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function getPlan(userId: string, planId: string) {
  const plan = await prisma.shoppingPlan.findFirst({
    where: { id: planId, userId },
    select: planSelect,
  });
  if (!plan) throw AppError.notFound("Shopping plan nggak ketemu.");
  return plan;
}

export async function updatePlan(userId: string, planId: string, input: UpdatePlanInput) {
  await requireOwnPlan(userId, planId);
  return prisma.$transaction(async (tx) => {
    await tx.shoppingPlan.update({
      where: { id: planId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.budget !== undefined ? { budget: new Prisma.Decimal(input.budget) } : {}),
      },
    });
    return recalculate(tx, planId);
  });
}

/**
 * Menghapus rencana beserta isinya. Item ikut terhapus lewat onDelete: Cascade
 * di schema, jadi tidak perlu dibersihkan manual.
 *
 * Endpoint ini sebelumnya tidak ada sama sekali: CRUD hanya lengkap untuk item
 * DI DALAM rencana, sementara rencananya sendiri tidak bisa dihapus dan
 * frontend membalas "Endpoint DELETE /shopping-plans/:id nggak ada".
 */
export async function deletePlan(userId: string, planId: string) {
  await requireOwnPlan(userId, planId);
  await prisma.shoppingPlan.delete({ where: { id: planId } });
  return { deleted: true };
}

export async function addItem(userId: string, planId: string, productId: string, quantity: number) {
  await requireOwnPlan(userId, planId);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true, price: true },
    });
    if (!product) throw AppError.notFound("Produk nggak ketemu.");

    await tx.shoppingPlanItem.create({
      data: {
        shoppingPlanId: planId,
        productId,
        quantity,
        priceAtAdd: product.price,
        subtotal: product.price.times(quantity),
      },
    });

    return recalculate(tx, planId);
  });
}

export async function updateItem(
  userId: string,
  planId: string,
  itemId: string,
  quantity: number
) {
  await requireOwnPlan(userId, planId);

  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingPlanItem.findFirst({
      where: { id: itemId, shoppingPlanId: planId },
      select: { id: true, priceAtAdd: true },
    });
    if (!item) throw AppError.notFound("Item plan nggak ketemu.");

    await tx.shoppingPlanItem.update({
      where: { id: item.id },
      data: { quantity, subtotal: item.priceAtAdd.times(quantity) },
    });

    return recalculate(tx, planId);
  });
}

export async function replaceItem(
  userId: string,
  planId: string,
  itemId: string,
  productId: string,
  quantity?: number
) {
  await requireOwnPlan(userId, planId);

  return prisma.$transaction(async (tx) => {
    const item = await tx.shoppingPlanItem.findFirst({
      where: { id: itemId, shoppingPlanId: planId },
      select: { id: true, quantity: true },
    });
    if (!item) throw AppError.notFound("Item plan nggak ketemu.");

    const product = await tx.product.findFirst({
      where: { id: productId, isActive: true },
      select: { id: true, price: true },
    });
    if (!product) throw AppError.notFound("Produk pengganti nggak ketemu.");

    const newQuantity = quantity ?? item.quantity;
    await tx.shoppingPlanItem.update({
      where: { id: item.id },
      data: {
        productId,
        quantity: newQuantity,
        priceAtAdd: product.price,
        subtotal: product.price.times(newQuantity),
        isReplaced: true,
      },
    });

    return recalculate(tx, planId);
  });
}

export async function removeItem(userId: string, planId: string, itemId: string) {
  await requireOwnPlan(userId, planId);

  return prisma.$transaction(async (tx) => {
    const deleted = await tx.shoppingPlanItem.deleteMany({
      where: { id: itemId, shoppingPlanId: planId },
    });
    if (deleted.count === 0) throw AppError.notFound("Item plan nggak ketemu.");
    return recalculate(tx, planId);
  });
}

export async function alternatives(userId: string, planId: string) {
  const plan = await prisma.shoppingPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, needId: true, items: { select: { id: true, priceAtAdd: true, productId: true } } },
  });
  if (!plan) throw AppError.notFound("Shopping plan nggak ketemu.");
  if (!plan.needId) {
    throw AppError.badRequest(
      "Plan ini nggak terhubung ke need, jadi nggak ada alternatif rekomendasi.",
      "PLAN_HAS_NO_NEED"
    );
  }

  const needId = plan.needId;
  return Promise.all(
    plan.items.map(async (item) => ({
      itemId: item.id,
      currentProductId: item.productId,
      alternatives: await cheaperAlternatives(needId, Number(item.priceAtAdd)),
    }))
  );
}

export async function addAllToCart(userId: string, planId: string) {
  const plan = await prisma.shoppingPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true, items: { select: { productId: true, quantity: true } } },
  });
  if (!plan) throw AppError.notFound("Shopping plan nggak ketemu.");

  const added: string[] = [];
  const failed: { productId: string; reason: string }[] = [];

  for (const item of plan.items) {
    try {
      await addCartItem(userId, item.productId, item.quantity);
      added.push(item.productId);
    } catch (error) {
      failed.push({
        productId: item.productId,
        reason: error instanceof AppError ? error.code : "UNKNOWN_ERROR",
      });
    }
  }

  return { added: added.length, failed };
}

async function requireOwnPlan(userId: string, planId: string) {
  const plan = await prisma.shoppingPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!plan) throw AppError.notFound("Shopping plan nggak ketemu.");
  return plan;
}
