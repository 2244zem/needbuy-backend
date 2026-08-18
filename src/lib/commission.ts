import { Prisma } from "@prisma/client";

export const DEFAULT_COMMISSION_PERCENT = 30;

export function isValidCommissionPercent(percent: number): boolean {
  return Number.isFinite(percent) && percent >= 0 && percent <= 100;
}

export function commissionFor(
  orderTotal: Prisma.Decimal,
  percent: Prisma.Decimal
): Prisma.Decimal {
  const zero = new Prisma.Decimal(0);
  if (orderTotal.lte(zero)) return zero;

  const rate = isValidCommissionPercent(percent.toNumber())
    ? percent
    : new Prisma.Decimal(DEFAULT_COMMISSION_PERCENT);

  return orderTotal.times(rate).dividedBy(100).toDecimalPlaces(2);
}
