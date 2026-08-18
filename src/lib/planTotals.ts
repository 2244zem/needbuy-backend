import { Prisma } from "@prisma/client";

export type PlanStatusName = "DRAFT" | "READY" | "NEEDS_ADJUSTMENT";

export function computePlanTotals(
  items: { subtotal: Prisma.Decimal }[],
  budget: Prisma.Decimal
): { total: Prisma.Decimal; remaining: Prisma.Decimal; status: PlanStatusName } {
  const total = items.reduce((sum, item) => sum.plus(item.subtotal), new Prisma.Decimal(0));
  const remaining = budget.minus(total);
  
  const status: PlanStatusName =
    budget.isZero() || !remaining.isNegative() ? "READY" : "NEEDS_ADJUSTMENT";
  return { total, remaining, status };
}
