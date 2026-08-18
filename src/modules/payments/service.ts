import type { PaymentStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { logger, withExternalCall } from "../../config/logger";
import { coreApi, snap } from "../../config/midtrans";
import { AppError } from "../../lib/apiError";
import { expectedSignature } from "../../lib/midtransSignature";
import { generateMidtransOrderId } from "../../lib/orderNumber";
import { buildSnapItems, sumSnapItems } from "../../lib/snapItems";
import { handleNotification, type MidtransNotification } from "./webhook.service";

export async function createSnapForOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      shippingCost: true,
      discount: true,
      status: true,
      user: { select: { name: true, email: true, phone: true } },
      items: { select: { productId: true, productName: true, price: true, quantity: true } },
      payment: { select: { id: true, midtransOrderId: true, status: true, method: true } },
    },
  });

  if (!order?.payment) throw AppError.notFound("Order atau payment nggak ketemu.");
  if (order.payment.method === "COD") {
    throw AppError.conflict("Order ini memakai COD, nggak perlu pembayaran online.", "COD_ORDER");
  }
  if (order.payment.status === "PAID") {
    throw AppError.conflict("Order ini udah dibayar.", "ALREADY_PAID");
  }

  const itemDetails = buildSnapItems({
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      price: Number(item.price),
      quantity: item.quantity,
    })),
    shippingCost: Number(order.shippingCost),
    discount: Number(order.discount),
  });

  const grossAmount = Number(order.total);
  const itemsTotal = sumSnapItems(itemDetails);
  if (itemsTotal !== grossAmount) {
    logger.error(
      { orderId: order.id, itemsTotal, grossAmount },
      "item_details tidak sama dengan gross_amount"
    );
    throw AppError.badRequest(
      "Rincian harga pesanan ini nggak konsisten, jadi pembayarannya nggak bisa dibuat.",
      "PRICE_BREAKDOWN_MISMATCH"
    );
  }

  const transaction = await withExternalCall("midtrans", "snap.createTransaction", () =>
    snap.createTransaction({
      transaction_details: {
        order_id: order.payment!.midtransOrderId,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: {
        first_name: order.user.name,
        email: order.user.email,
        ...(order.user.phone ? { phone: order.user.phone } : {}),
      },
    })
  ).catch((error) => {
    logger.error({ err: error, orderId: order.id }, "snap.createTransaction gagal");
    throw AppError.serviceUnavailable(
      "Gateway pembayaran lagi nggak bisa dihubungi. Coba lagi sebentar lagi ya.",
      "GATEWAY_UNAVAILABLE"
    );
  });

  const updated = await prisma.payment.update({
    where: { id: order.payment.id },
    data: { snapToken: transaction.token, snapRedirectUrl: transaction.redirect_url },
    select: { id: true, status: true, snapToken: true, snapRedirectUrl: true, midtransOrderId: true },
  });

  return { orderId: order.id, orderNumber: order.orderNumber, payment: updated };
}

async function fetchGatewayStatus(midtransOrderId: string): Promise<Record<string, unknown> | null> {
  try {
    return (await withExternalCall("midtrans", "transaction.status", () =>
      coreApi.transaction.status(midtransOrderId)
    )) as Record<string, unknown>;
  } catch (error) {
    const httpCode = (error as { httpStatusCode?: number | string })?.httpStatusCode;
    if (String(httpCode) === "404") return null;
    throw AppError.serviceUnavailable(
      "Tidak bisa menghubungi gateway pembayaran. Coba lagi sebentar lagi.",
      "GATEWAY_UNAVAILABLE"
    );
  }
}

export async function syncMidtransOrder(midtransOrderId: string) {
  const status = await fetchGatewayStatus(midtransOrderId);
  if (!status) return { synced: false as const, reason: "NO_TRANSACTION" as const };

  const notification = {
    ...status,
    order_id: String(status.order_id ?? midtransOrderId),
    status_code: String(status.status_code ?? ""),
    gross_amount: String(status.gross_amount ?? ""),
    transaction_status: String(status.transaction_status ?? ""),
    signature_key:
      typeof status.signature_key === "string"
        ? status.signature_key
        : expectedSignature(
            String(status.order_id ?? midtransOrderId),
            String(status.status_code ?? ""),
            String(status.gross_amount ?? ""),
            env.MIDTRANS_SERVER_KEY
          ),
  } as MidtransNotification;

  return { synced: true as const, result: await handleNotification(notification) };
}

export async function syncTopup(userId: string, topupId: string) {
  const topup = await prisma.walletTransaction.findFirst({
    where: { id: topupId, type: "TOPUP", wallet: { userId } },
    select: { id: true, midtransOrderId: true, status: true },
  });
  if (!topup?.midtransOrderId) throw AppError.notFound("Top up NeedPay nggak ketemu.");

  if (topup.status !== "PENDING") {
    return { synced: false as const, reason: "ALREADY_SETTLED" as const, status: topup.status };
  }

  const pulled = await syncMidtransOrder(topup.midtransOrderId);
  if (!pulled.synced) {
    return { synced: false as const, reason: pulled.reason, status: topup.status };
  }

  const fresh = await prisma.walletTransaction.findUniqueOrThrow({
    where: { id: topup.id },
    select: { status: true, balanceAfter: true, wallet: { select: { balance: true } } },
  });

  return {
    synced: true as const,
    status: fresh.status,
    balance: fresh.wallet.balance,
  };
}

export async function retrySnap(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, userId },
    select: {
      id: true,
      status: true,
      orderNumber: true,
      payment: {
        select: {
          id: true,
          status: true,
          method: true,
          midtransOrderId: true,
          snapToken: true,
          snapRedirectUrl: true,
        },
      },
    },
  });
  if (!order) throw AppError.notFound("Order nggak ketemu.");
  if (order.status !== "WAITING_PAYMENT") {
    throw AppError.conflict("Order ini nggak nunggu pembayaran.", "ORDER_NOT_WAITING_PAYMENT");
  }
  const payment = order.payment;
  if (!payment) throw AppError.notFound("Payment nggak ketemu.");
  if (payment.method === "COD") {
    throw AppError.conflict("Order ini memakai COD, nggak perlu pembayaran online.", "COD_ORDER");
  }
  if (payment.status === "PAID") {
    throw AppError.conflict("Order ini udah dibayar.", "ALREADY_PAID");
  }

  const gateway = await fetchGatewayStatus(payment.midtransOrderId);

  if (!gateway) return createSnapForOrder(orderId);

  await syncFromGateway(userId, orderId);

  const transactionStatus = String(gateway.transaction_status ?? "");
  if (transactionStatus === "settlement" || transactionStatus === "capture") {
    throw AppError.conflict("Order ini udah dibayar.", "ALREADY_PAID");
  }

  if (transactionStatus === "pending" && payment.snapToken) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      payment: {
        id: payment.id,
        status: payment.status,
        snapToken: payment.snapToken,
        snapRedirectUrl: payment.snapRedirectUrl,
        midtransOrderId: payment.midtransOrderId,
      },
    };
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      midtransOrderId: generateMidtransOrderId(order.orderNumber),
      snapToken: null,
      snapRedirectUrl: null,
    },
  });

  return createSnapForOrder(orderId);
}

export async function syncFromGateway(userId: string, orderId: string) {
  const payment = await prisma.payment.findFirst({
    where: { orderId, order: { userId } },
    select: { id: true, midtransOrderId: true, method: true, status: true },
  });
  if (!payment) throw AppError.notFound("Payment nggak ketemu.");
  if (payment.method === "COD") {
    throw AppError.conflict("Order ini memakai COD, nggak ada transaksi online.", "COD_ORDER");
  }

  const pulled = await syncMidtransOrder(payment.midtransOrderId);
  if (!pulled.synced) {
    return { synced: false as const, reason: pulled.reason, status: payment.status };
  }

  const result = pulled.result;
  const fresh = await prisma.payment.findUnique({
    where: { id: payment.id },
    select: { status: true, method: true, paidAt: true, order: { select: { status: true } } },
  });

  return { synced: true as const, result, payment: fresh };
}

export async function getForOrder(userId: string, orderId: string) {
  const payment = await prisma.payment.findFirst({
    where: { orderId, order: { userId } },
    select: {
      id: true,
      status: true,
      method: true,
      snapToken: true,
      snapRedirectUrl: true,
      midtransOrderId: true,
      paidAt: true,
      createdAt: true,
    },
  });
  if (!payment) throw AppError.notFound("Payment nggak ketemu.");
  return payment;
}

export async function listAllForAdmin(query: {
  status?: PaymentStatus;
  method?: string;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.method ? { method: query.method } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        status: true,
        method: true,
        midtransOrderId: true,
        midtransTransactionId: true,
        paidAt: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            total: true,
            user: { select: { id: true, name: true, email: true } },
            seller: { select: { storeName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}
