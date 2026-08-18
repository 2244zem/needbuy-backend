import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { computeCouponDiscount, type CouponRule } from "../../lib/coupon";

const ruleSelect = {
  id: true,
  code: true,
  title: true,
  type: true,
  category: true,
  value: true,
  minSpend: true,
  maxDiscount: true,
  expiresAt: true,
  isActive: true,
} satisfies Prisma.CouponSelect;

export type ResolvedCoupon = {
  couponId: string;
  claimId: string;
  code: string;
  title: string;
  category: string;
  discount: Prisma.Decimal;
};

export async function resolveCoupon(
  tx: Prisma.TransactionClient,
  userId: string,
  code: string,
  subtotal: Prisma.Decimal,
  shippingCost: Prisma.Decimal
): Promise<ResolvedCoupon> {
  const claim = await tx.userCoupon.findFirst({
    where: { userId, coupon: { code } },
    select: { id: true, usedAt: true, coupon: { select: ruleSelect } },
  });
  if (!claim) {
    throw AppError.badRequest(
      "Kupon ini belum kamu klaim. Klaim dulu di halaman Kupon ya.",
      "COUPON_NOT_CLAIMED"
    );
  }
  if (claim.usedAt) {
    throw AppError.badRequest("Kupon ini udah kepakai.", "COUPON_ALREADY_USED");
  }

  const coupon = claim.coupon;
  if (!coupon.isActive) {
    throw AppError.badRequest("Kupon ini udah nggak berlaku.", "COUPON_INACTIVE");
  }
  if (coupon.expiresAt && coupon.expiresAt <= new Date()) {
    throw AppError.badRequest("Kupon ini udah kedaluwarsa.", "COUPON_EXPIRED");
  }

  const rule: CouponRule = {
    type: coupon.type,
    value: coupon.value,
    minSpend: coupon.minSpend,
    maxDiscount: coupon.maxDiscount,
  };
  const check = computeCouponDiscount(rule, subtotal, shippingCost);

  if (!check.eligible) {
    if (check.reason === "MIN_SPEND_NOT_MET") {
      throw AppError.badRequest(
        `Belanjaanmu kurang ${formatRupiah(check.shortfall)} lagi buat pakai kupon ini.`,
        "COUPON_MIN_SPEND_NOT_MET"
      );
    }
    throw AppError.badRequest(
      "Kupon ini nggak memotong apa-apa di pesanan ini.",
      "COUPON_NOTHING_TO_DISCOUNT"
    );
  }

  return {
    couponId: coupon.id,
    claimId: claim.id,
    code: coupon.code,
    title: coupon.title,
    category: coupon.category,
    discount: check.discount,
  };
}

export async function consumeCoupon(tx: Prisma.TransactionClient, claimId: string) {
  const locked = await tx.userCoupon.updateMany({
    where: { id: claimId, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (locked.count === 0) {
    throw AppError.conflict("Kupon ini barusan kepakai di pesanan lain.", "COUPON_ALREADY_USED");
  }
}

export async function grantRandomReward(userId: string): Promise<{ code: string; title: string; category: string } | null> {
  const now = new Date();

  const pool = await prisma.coupon.findMany({
    where: {
      isReward: true,
      isActive: true,
      claims: { none: { userId } },
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        { OR: [{ quota: null }, { quota: { gt: 0 } }] },
      ],
    },
    select: { id: true, code: true, title: true, category: true, quota: true, usedCount: true },
  });

  const available = pool.filter((c) => c.quota === null || c.usedCount < c.quota);
  if (available.length === 0) return null;

  const pick = available[Math.floor(Math.random() * available.length)];

  try {
    await prisma.$transaction(async (tx) => {
      const taken = await tx.coupon.updateMany({
        where: {
          id: pick.id,
          OR: [{ quota: null }, { quota: { not: null }, usedCount: { lt: pick.quota ?? 0 } }],
        },
        data: { usedCount: { increment: 1 } },
      });
      if (taken.count === 0) throw AppError.conflict("Kuota kupon habis.", "COUPON_SOLD_OUT");

      await tx.userCoupon.create({ data: { userId, couponId: pick.id } });
    });
  } catch {
    return null;
  }

  return { code: pick.code, title: pick.title, category: pick.category };
}

function formatRupiah(value: Prisma.Decimal): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}
