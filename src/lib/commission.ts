import { Prisma } from "@prisma/client";

/**
 * Tarif komisi platform, dikunci di 10% atas keputusan pemilik.
 *
 * Nilainya tetap disalin ke kolom `commissionAmount` tiap pesanan saat
 * checkout, jadi mengubah angka ini nanti tidak akan menggeser pembukuan
 * pesanan lama.
 */
export const COMMISSION_PERCENT = 10;

/** @deprecated Pakai COMMISSION_PERCENT. Dipertahankan supaya impor lama tidak putus. */
export const DEFAULT_COMMISSION_PERCENT = COMMISSION_PERCENT;

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
