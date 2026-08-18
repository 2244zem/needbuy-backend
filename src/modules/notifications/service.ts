import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { publish } from "./hub";
import type { ListNotificationsQuery } from "./schema";

type Tx = Prisma.TransactionClient | PrismaClient;

const listSelect = {
  id: true,
  type: true,
  title: true,
  message: true,
  orderId: true,
  readAt: true,
  createdAt: true,
  order: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      total: true,
      payment: { select: { method: true } },
      items: { select: { productId: true, productName: true, quantity: true } },
    },
  },
} as const;

type NotificationRow = Prisma.NotificationGetPayload<{ select: typeof listSelect }>;

function toDto(row: NotificationRow) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    read: row.readAt !== null,
    readAt: row.readAt,
    createdAt: row.createdAt,
    order: row.order
      ? {
          orderId: row.order.id,
          orderNumber: row.order.orderNumber,
          
          orderType: row.order.payment?.method ?? null,
          status: row.order.status,
          total: Number(row.order.total),
          items: row.order.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
          })),
        }
      : null,
  };
}

export async function list(userId: string, query: ListNotificationsQuery) {
  const rows = await prisma.notification.findMany({
    where: { userId, ...(query.unreadOnly ? { readAt: null } : {}) },
    select: listSelect,
    orderBy: { createdAt: "desc" },
    take: query.limit,
  });
  return rows.map(toDto);
}

export async function unreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, readAt: null } });
  return { unreadCount: count };
}

export async function markAllRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  publish(userId, { event: "unread-count", data: { unreadCount: 0 } });
  return { updated: result.count, unreadCount: 0 };
}

export async function markRead(userId: string, id: string) {
  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) throw AppError.notFound("Notifikasi nggak ketemu.");
  }
  const { unreadCount: remaining } = await unreadCount(userId);
  publish(userId, { event: "unread-count", data: { unreadCount: remaining } });
  return { unreadCount: remaining };
}

export async function createFor(
  tx: Tx,
  input: { userId: string; type: NotificationType; title: string; message: string; orderId?: string }
) {
  return tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      orderId: input.orderId ?? null,
    },
    select: { id: true, userId: true },
  });
}

export async function pushCreated(notificationIds: { id: string; userId: string }[]) {
  const userIds = [...new Set(notificationIds.map((n) => n.userId))];

  for (const userId of userIds) {
    const ids = notificationIds.filter((n) => n.userId === userId).map((n) => n.id);
    const rows = await prisma.notification.findMany({ where: { id: { in: ids } }, select: listSelect });
    for (const row of rows) {
      publish(userId, { event: "notification", data: toDto(row) });
    }
    const { unreadCount: remaining } = await unreadCount(userId);
    publish(userId, { event: "unread-count", data: { unreadCount: remaining } });
  }
}
