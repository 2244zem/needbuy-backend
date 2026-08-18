import { Prisma } from "@prisma/client";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { mapTransactionStatus, verifySignature } from "../../lib/midtransSignature";
import { isTopupOrderId } from "../../lib/needpay";
import { orderNumberFromMidtransOrderId } from "../../lib/orderNumber";
import { handlePaymentOutcome } from "../orders/service";
import { creditTopup, failTopup } from "../wallet/service";

export { expectedSignature, mapTransactionStatus, verifySignature } from "../../lib/midtransSignature";

export type MidtransNotification = {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  transaction_id?: string;
  payment_type?: string;
  [key: string]: unknown;
};

async function findPayment(midtransOrderId: string) {
  const select = { id: true, orderId: true, status: true, order: { select: { total: true } } };

  const direct = await prisma.payment.findUnique({ where: { midtransOrderId }, select });
  if (direct) return direct;

  const orderNumber = orderNumberFromMidtransOrderId(midtransOrderId);
  if (!orderNumber) return null;

  const fallback = await prisma.payment.findFirst({ where: { order: { orderNumber } }, select });
  if (fallback) {
    logger.warn(
      { midtransOrderId, orderNumber },
      "webhook memakai order_id lama, pembayaran dari sesi Snap sebelumnya"
    );
  }
  return fallback;
}

function amountMatches(grossAmount: string, orderTotal: Prisma.Decimal): boolean {
  try {
    return new Prisma.Decimal(grossAmount).equals(orderTotal);
  } catch {
    return false;
  }
}

async function handleTopupNotification(payload: MidtransNotification) {
  const nextStatus = mapTransactionStatus(payload.transaction_status);
  const raw = payload as Prisma.InputJsonValue;

  if (!nextStatus) return { handled: false, reason: "UNKNOWN_TRANSACTION_STATUS" as const };

  if (nextStatus === "PAID") {
    const topup = await prisma.walletTransaction.findUnique({
      where: { midtransOrderId: payload.order_id },
      select: { amount: true },
    });
    if (!topup) throw AppError.notFound("Top up NeedPay nggak ketemu.");

    if (!amountMatches(payload.gross_amount, topup.amount)) {
      logger.error(
        { midtransOrderId: payload.order_id, grossAmount: payload.gross_amount },
        "webhook top-up ditolak: gross_amount nggak sama dengan nominal top-up"
      );
      return { handled: false, reason: "AMOUNT_MISMATCH" as const };
    }

    const result = await creditTopup(payload.order_id, raw);
    return { handled: true, duplicate: !result.credited, status: nextStatus };
  }

  if (nextStatus === "FAILED" || nextStatus === "EXPIRED") {
    await failTopup(payload.order_id, nextStatus, raw);
    return { handled: true, duplicate: false as const, status: nextStatus };
  }

  return { handled: true, duplicate: false as const, status: nextStatus };
}

export async function handleNotification(payload: MidtransNotification) {
  if (!verifySignature(payload, env.MIDTRANS_SERVER_KEY)) {
    logger.warn({ orderId: payload.order_id }, "midtrans webhook signature invalid");
    throw AppError.forbidden("Signature nggak valid.", "INVALID_SIGNATURE");
  }

  if (isTopupOrderId(payload.order_id)) return handleTopupNotification(payload);

  const payment = await findPayment(payload.order_id);
  if (!payment) throw AppError.notFound("Payment nggak ketemu.");

  const nextStatus = mapTransactionStatus(payload.transaction_status);
  if (!nextStatus) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { rawResponse: payload as Prisma.InputJsonValue },
    });
    return { handled: false, reason: "UNKNOWN_TRANSACTION_STATUS" as const };
  }

  if (payment.status === "PAID" && nextStatus !== "REFUNDED" && nextStatus !== "PAID") {
    logger.warn(
      { orderId: payment.orderId, nextStatus },
      "notifikasi telat diabaikan: payment udah PAID"
    );
    await prisma.payment.update({
      where: { id: payment.id },
      data: { rawResponse: payload as Prisma.InputJsonValue },
    });
    return { handled: false, reason: "ALREADY_PAID" as const };
  }

  if (nextStatus === "PAID" && !amountMatches(payload.gross_amount, payment.order.total)) {
    logger.error(
      { orderId: payment.orderId, grossAmount: payload.gross_amount },
      "webhook ditolak: gross_amount nggak sama dengan total order"
    );
    await prisma.payment.update({
      where: { id: payment.id },
      data: { rawResponse: payload as Prisma.InputJsonValue },
    });
    return { handled: false, reason: "AMOUNT_MISMATCH" as const };
  }

  if (payment.status === nextStatus) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { rawResponse: payload as Prisma.InputJsonValue },
    });
    return { handled: true, duplicate: true as const, status: nextStatus };
  }

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        method: payload.payment_type ?? null,
        midtransTransactionId: payload.transaction_id ?? null,
        
        rawResponse: payload as Prisma.InputJsonValue,
        ...(nextStatus === "PAID" ? { paidAt: new Date() } : {}),
      },
    });
  });

  if (nextStatus === "PAID") {
    await handlePaymentOutcome(payment.orderId, "PAID");
  } else if (nextStatus === "FAILED" || nextStatus === "EXPIRED") {
    await handlePaymentOutcome(payment.orderId, "FAILED");
  }

  return { handled: true, duplicate: false as const, status: nextStatus };
}
