import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import type { ListCouponsQuery } from "./schema";

const couponSelect = {
  id: true,
  code: true,
  title: true,
  description: true,
  type: true,
  
  category: true,
  value: true,
  minSpend: true,
  maxDiscount: true,
  quota: true,
  usedCount: true,
  startsAt: true,
  expiresAt: true,
} satisfies Prisma.CouponSelect;

function claimableWhere(now: Date): Prisma.CouponWhereInput {
  return {
    isActive: true,
    AND: [
      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    ],
  };
}

export async function list(userId: string, query: ListCouponsQuery) {
  const { skip, take } = toSkipTake(query);
  const now = new Date();

  if (query.scope === "mine") {
    const where: Prisma.UserCouponWhereInput = { userId };
    const [items, total] = await Promise.all([
      prisma.userCoupon.findMany({
        where,
        skip,
        take,
        orderBy: [{ usedAt: "asc" }, { claimedAt: "desc" }],
        select: { id: true, claimedAt: true, usedAt: true, coupon: { select: couponSelect } },
      }),
      prisma.userCoupon.count({ where }),
    ]);

    return {
      items: items.map((row) => ({
        ...row.coupon,
        claimId: row.id,
        claimedAt: row.claimedAt,
        usedAt: row.usedAt,
        claimed: true,
        expired: !!row.coupon.expiresAt && row.coupon.expiresAt <= now,
      })),
      meta: buildMeta(query, total),
    };
  }

  const where: Prisma.CouponWhereInput = {
    ...claimableWhere(now),
    claims: { none: { userId } },
  };

  const [items, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take,
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
      select: couponSelect,
    }),
    prisma.coupon.count({ where }),
  ]);

  return {
    items: items.map((coupon) => ({
      ...coupon,
      claimId: null,
      claimedAt: null,
      usedAt: null,
      claimed: false,
      expired: false,
      soldOut: coupon.quota !== null && coupon.usedCount >= coupon.quota,
    })),
    meta: buildMeta(query, total),
  };
}

export async function claim(userId: string, couponId: string) {
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const coupon = await tx.coupon.findFirst({
      where: { id: couponId, ...claimableWhere(now) },
      select: couponSelect,
    });
    if (!coupon) throw AppError.notFound("Kupon nggak ketemu atau udah nggak berlaku.");

    const existing = await tx.userCoupon.findUnique({
      where: { userId_couponId: { userId, couponId } },
      select: { id: true },
    });
    if (existing) throw AppError.conflict("Kupon ini udah ada di daftar kupon kamu.");

    const taken = await tx.coupon.updateMany({
      where: {
        id: couponId,
        
        OR: [
          { quota: null },
          { quota: { not: null }, usedCount: { lt: coupon.quota ?? 0 } },
        ],
      },
      data: { usedCount: { increment: 1 } },
    });
    if (taken.count === 0) throw AppError.conflict("Kuota kupon udah habis.");

    const claimed = await tx.userCoupon.create({
      data: { userId, couponId },
      select: { id: true, claimedAt: true },
    });

    return { ...coupon, claimId: claimed.id, claimedAt: claimed.claimedAt, claimed: true };
  });
}

export async function claimByCode(userId: string, code: string) {
  const coupon = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (!coupon) throw AppError.notFound("Kode kupon nggak ketemu.");
  return claim(userId, coupon.id);
}

const adminCouponSelect = {
  ...couponSelect,
  isActive: true,
  isReward: true,
  createdAt: true,
  _count: { select: { claims: true } },
} satisfies Prisma.CouponSelect;

export async function listAllForAdmin(query: {
  isActive?: boolean;
  page: number;
  limit: number;
}) {
  const where = query.isActive !== undefined ? { isActive: query.isActive } : {};
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      select: adminCouponSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.coupon.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function createCoupon(input: {
  code: string;
  title: string;
  description?: string | null;
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  category: "SHIPPING" | "CASHBACK" | "DISCOUNT";
  value: number;
  minSpend?: number;
  maxDiscount?: number | null;
  quota?: number | null;
  startsAt?: string | null;
  expiresAt?: string | null;
  isActive?: boolean;
}) {
  const clash = await prisma.coupon.findUnique({
    where: { code: input.code },
    select: { id: true },
  });
  if (clash) throw AppError.conflict("Kode kupon udah dipakai.", "COUPON_CODE_TAKEN");

  return prisma.coupon.create({
    data: {
      code: input.code,
      title: input.title,
      description: input.description ?? null,
      type: input.type,
      category: input.category,
      value: new Prisma.Decimal(input.value),
      minSpend: new Prisma.Decimal(input.minSpend ?? 0),
      maxDiscount: input.maxDiscount != null ? new Prisma.Decimal(input.maxDiscount) : null,
      quota: input.quota ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: adminCouponSelect,
  });
}

export async function updateCoupon(
  couponId: string,
  input: {
    title?: string;
    description?: string | null;
    value?: number;
    minSpend?: number;
    maxDiscount?: number | null;
    quota?: number | null;
    startsAt?: string | null;
    expiresAt?: string | null;
    isActive?: boolean;
  }
) {
  const existing = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true },
  });
  if (!existing) throw AppError.notFound("Kupon nggak ketemu.");

  return prisma.coupon.update({
    where: { id: couponId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.value !== undefined ? { value: new Prisma.Decimal(input.value) } : {}),
      ...(input.minSpend !== undefined ? { minSpend: new Prisma.Decimal(input.minSpend) } : {}),
      ...(input.maxDiscount !== undefined
        ? { maxDiscount: input.maxDiscount != null ? new Prisma.Decimal(input.maxDiscount) : null }
        : {}),
      ...(input.quota !== undefined ? { quota: input.quota } : {}),
      ...(input.startsAt !== undefined
        ? { startsAt: input.startsAt ? new Date(input.startsAt) : null }
        : {}),
      ...(input.expiresAt !== undefined
        ? { expiresAt: input.expiresAt ? new Date(input.expiresAt) : null }
        : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
    select: adminCouponSelect,
  });
}
