import { Prisma } from "@prisma/client";

export type BulkOffer = {
  bulkMinQty: number | null;
  bulkDiscountPercent: number | null;
};

export function hasBulkOffer(offer: BulkOffer): boolean {
  const { bulkMinQty, bulkDiscountPercent } = offer;
  return (
    bulkMinQty !== null &&
    bulkDiscountPercent !== null &&
    bulkMinQty >= 2 &&
    bulkDiscountPercent >= 1 &&
    bulkDiscountPercent <= 90
  );
}

export function bulkDiscountFor(offer: BulkOffer, quantity: number): number {
  if (!hasBulkOffer(offer)) return 0;
  return quantity >= (offer.bulkMinQty as number) ? (offer.bulkDiscountPercent as number) : 0;
}

export function bulkSubtotal(
  unitPrice: Prisma.Decimal,
  quantity: number,
  offer: BulkOffer
): Prisma.Decimal {
  const gross = unitPrice.times(quantity);
  const percent = bulkDiscountFor(offer, quantity);
  if (percent === 0) return gross;
  return gross.times(100 - percent).dividedBy(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
}
