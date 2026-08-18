import { Prisma } from "@prisma/client";

export type CouponRule = {
  type: "PERCENT" | "FIXED" | "FREE_SHIPPING";
  
  value: Prisma.Decimal;
  minSpend: Prisma.Decimal;
  
  maxDiscount: Prisma.Decimal | null;
};

export type CouponCheck =
  | { eligible: true; discount: Prisma.Decimal }
  | { eligible: false; reason: "MIN_SPEND_NOT_MET" | "NOTHING_TO_DISCOUNT"; shortfall: Prisma.Decimal };

const ZERO = new Prisma.Decimal(0);

export function computeCouponDiscount(
  rule: CouponRule,
  subtotal: Prisma.Decimal,
  shippingCost: Prisma.Decimal
): CouponCheck {
  if (subtotal.lessThan(rule.minSpend)) {
    return {
      eligible: false,
      reason: "MIN_SPEND_NOT_MET",
      shortfall: rule.minSpend.minus(subtotal),
    };
  }

  let discount: Prisma.Decimal;

  if (rule.type === "FREE_SHIPPING") {
    discount = shippingCost;
  } else if (rule.type === "PERCENT") {
    discount = subtotal.times(rule.value).dividedBy(100).floor();
    if (rule.maxDiscount !== null && discount.greaterThan(rule.maxDiscount)) {
      discount = rule.maxDiscount;
    }
  } else {
    discount = rule.value;
  }

  const ceiling = rule.type === "FREE_SHIPPING" ? shippingCost : subtotal;
  if (discount.greaterThan(ceiling)) discount = ceiling;

  if (discount.lessThanOrEqualTo(ZERO)) {
    return { eligible: false, reason: "NOTHING_TO_DISCOUNT", shortfall: ZERO };
  }

  return { eligible: true, discount };
}

export function splitDiscount(
  subtotals: Prisma.Decimal[],
  discount: Prisma.Decimal
): Prisma.Decimal[] {
  const total = subtotals.reduce((sum, value) => sum.plus(value), ZERO);
  if (total.isZero() || discount.lessThanOrEqualTo(ZERO)) {
    return subtotals.map(() => ZERO);
  }

  const shares = subtotals.map((value) => discount.times(value).dividedBy(total).floor());
  const distributed = shares.reduce((sum, value) => sum.plus(value), ZERO);
  const remainder = discount.minus(distributed);

  if (!remainder.isZero()) {
    let largest = 0;
    for (let i = 1; i < subtotals.length; i += 1) {
      if (subtotals[i].greaterThan(subtotals[largest])) largest = i;
    }
    shares[largest] = shares[largest].plus(remainder);
  }

  return shares;
}
