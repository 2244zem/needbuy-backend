import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

export const MIN_TOPUP = 10_000;
export const MAX_TOPUP = 10_000_000;

export const MIN_WITHDRAWAL = 50_000;
export const MAX_WITHDRAWAL = 100_000_000;

export const TOPUP_PREFIX = "NPTU";

export function generateTopupOrderId(now: Date = new Date()): string {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `${TOPUP_PREFIX}-${now.getTime()}-${random}`;
}

export function isTopupOrderId(midtransOrderId: string): boolean {
  return midtransOrderId.startsWith(`${TOPUP_PREFIX}-`);
}

export function applyToBalance(
  balance: Prisma.Decimal,
  type: "TOPUP" | "PAYMENT" | "REFUND" | "WITHDRAWAL",
  amount: Prisma.Decimal
): Prisma.Decimal {
  if (amount.isNegative() || amount.isZero()) {
    throw new Error("Nominal transaksi NeedPay harus lebih dari nol.");
  }
  const debit = type === "PAYMENT" || type === "WITHDRAWAL";
  const next = debit ? balance.minus(amount) : balance.plus(amount);
  if (next.isNegative()) throw new Error("Saldo NeedPay nggak cukup.");
  return next;
}

export function isValidWithdrawalAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_WITHDRAWAL && amount <= MAX_WITHDRAWAL;
}

export function isValidTopupAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_TOPUP && amount <= MAX_TOPUP;
}
