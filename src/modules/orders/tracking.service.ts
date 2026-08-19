import type { Prisma, TrackingStage } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { furthestStage, isTerminal, STAGE_ORDER } from "../../lib/tracking";
import { publish } from "../notifications/hub";

const trackingSelect = {
  id: true,
  stage: true,
  description: true,
  location: true,
  createdById: true,
  createdAt: true,
} satisfies Prisma.OrderTrackingSelect;

export async function addEvent(
  tx: Prisma.TransactionClient,
  input: {
    orderId: string;
    stage: TrackingStage;
    description: string;
    location?: string | null;
    createdById?: string | null;
  }
) {
  return tx.orderTracking.create({
    data: {
      orderId: input.orderId,
      stage: input.stage,
      description: input.description,
      location: input.location ?? null,
      createdById: input.createdById ?? null,
    },
    select: trackingSelect,
  });
}

export function pushEvent(userId: string, orderId: string, event: unknown) {
  publish(userId, { event: "tracking", data: { orderId, event } });
}

export async function getForOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    // Penjual pemilik order ikut boleh melihat: itu pengiriman dia sendiri,
    // dan kartu pesanan yang dikirim pembeli lewat chat mengarah ke halaman
    // lacak yang sama. Sebelumnya hanya pembeli yang lolos, sehingga penjual
    // yang membuka kartu itu selalu dapat "Pesanan nggak ketemu".
    where: { id: orderId, OR: [{ userId }, { seller: { userId } }] },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      seller: { select: { storeName: true } },
      address: { select: { city: true, province: true } },
      tracking: { select: trackingSelect, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order) throw AppError.notFound("Pesanan nggak ketemu.");

  const reached = furthestStage(order.tracking.map((row) => row.stage));

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    storeName: order.seller.storeName,
    destination: [order.address.city, order.address.province].filter(Boolean).join(", "),
    currentStage: reached,
    
    finished: reached !== null && isTerminal(reached),
    stageOrder: STAGE_ORDER,
    events: order.tracking,
  };
}

export async function addBySeller(
  sellerUserId: string,
  orderId: string,
  input: { stage: TrackingStage; description: string; location?: string }
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, seller: { userId: sellerUserId } },
    select: { id: true, userId: true, status: true },
  });
  if (!order) throw AppError.notFound("Pesanan nggak ketemu.");

  if (order.status === "WAITING_PAYMENT") {
    throw AppError.badRequest(
      "Pesanan ini belum dibayar, jadi belum ada paket yang bisa dilacak.",
      "ORDER_NOT_PAID"
    );
  }

  const event = await addEvent(prisma as unknown as Prisma.TransactionClient, {
    orderId: order.id,
    stage: input.stage,
    description: input.description,
    location: input.location ?? null,
    createdById: sellerUserId,
  });

  pushEvent(order.userId, order.id, event);
  return event;
}
