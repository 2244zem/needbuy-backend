import type { OrderStatus, PaymentStatus, Prisma as PrismaTypes } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { canTransition as canTransitionStatus } from "../../lib/orderStatus";
import { createFor as createNotification, pushCreated } from "../notifications/service";
import { stageForStatus } from "../../lib/tracking";
import { addEvent as addTrackingEvent, pushEvent as pushTrackingEvent } from "./tracking.service";
import { creditSellerEarning, refundForOrder } from "../wallet/service";

export { TRANSITIONS, canTransition } from "../../lib/orderStatus";

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  shippingCost: true,
  total: true,
  deliveredAt: true,
  completedAt: true,
  createdAt: true,
  seller: { select: { id: true, storeName: true } },
  address: {
    select: { recipientName: true, phone: true, fullAddress: true, city: true, province: true, postalCode: true },
  },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      variant: true,
      quantity: true,
      price: true,
      subtotal: true,
      review: { select: { id: true, rating: true } },
      // Foto dipakai kartu pesanan di frontend. productName sudah di-snapshot,
      // tapi gambarnya tidak — jadi diambil dari produk aslinya saat dibaca.
      product: {
        select: {
          images: {
            select: { url: true, isPrimary: true },
            orderBy: [{ isPrimary: "desc" }, { sortOrder: "asc" }],
            take: 1,
          },
        },
      },
    },
  },
  payment: {
    select: { id: true, status: true, method: true, snapToken: true, snapRedirectUrl: true, paidAt: true },
  },
} satisfies PrismaTypes.OrderSelect;

export function mapPaymentStatus(orderStatus: OrderStatus, paymentStatus?: string, method?: string | null): string {
  if (orderStatus === "CANCELLED") return "Dibatalkan";
  if (orderStatus === "COMPLETED") return "Selesai";
  if (method === "COD") {
    return orderStatus === "DELIVERED" ? "Dibayar" : "Bayar di Tempat";
  }
  if (orderStatus === "WAITING_PAYMENT" || paymentStatus === "PENDING") return "Belum Dibayar";
  if (paymentStatus === "PAID" || orderStatus === "PROCESSING" || orderStatus === "SHIPPED" || orderStatus === "DELIVERED") return "Dibayar";
  return "Proses";
}

export function mapShippingStatus(orderStatus: OrderStatus): string {
  switch (orderStatus) {
    case "SHIPPED":
    case "DELIVERED":
    case "COMPLETED":
      return "Terkirim";
    case "PROCESSING":
      return "Proses (Amber)";
    case "CANCELLED":
      return "Dibatalkan";
    case "WAITING_PAYMENT":
    default:
      return "Tertunda";
  }
}

function buildSearchWhere(q?: string, search?: string): PrismaTypes.OrderWhereInput {
  const searchStr = (q || search)?.trim();
  if (!searchStr) return {};
  return {
    OR: [
      { orderNumber: { contains: searchStr, mode: "insensitive" } },
      { user: { name: { contains: searchStr, mode: "insensitive" } } },
      { user: { email: { contains: searchStr, mode: "insensitive" } } },
      { address: { recipientName: { contains: searchStr, mode: "insensitive" } } },
      { items: { some: { productName: { contains: searchStr, mode: "insensitive" } } } },
    ],
  };
}

function mapOrderDetails<T extends { status: OrderStatus; payment?: { status?: string; method?: string | null } | null; items: { quantity: number }[] }>(order: T) {
  const totalBarang = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    ...order,
    totalBarang,
    statusPembayaranLabel: mapPaymentStatus(order.status, order.payment?.status, order.payment?.method),
    statusPengirimanLabel: mapShippingStatus(order.status),
  };
}

export async function listForUser(
  userId: string,
  query: { status?: OrderStatus; q?: string; search?: string; page: number; limit: number }
) {
  const where = { userId, ...(query.status ? { status: query.status } : {}), ...buildSearchWhere(query.q, query.search) };
  const { skip, take } = toSkipTake(query);

  const [itemsRaw, total] = await Promise.all([
    prisma.order.findMany({ where, select: orderSelect, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.order.count({ where }),
  ]);

  const items = itemsRaw.map(mapOrderDetails);

  return { items, meta: buildMeta(query, total) };
}

export async function getForUser(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, select: orderSelect });
  if (!order) throw AppError.notFound("Order nggak ketemu.");
  return mapOrderDetails(order);
}

const sellerOrderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  subtotal: true,
  shippingCost: true,
  total: true,
  deliveredAt: true,
  completedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true } },
  address: {
    select: {
      recipientName: true,
      phone: true,
      fullAddress: true,
      city: true,
      province: true,
      postalCode: true,
    },
  },
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      variant: true,
      quantity: true,
      price: true,
      subtotal: true,
      review: { select: { id: true, rating: true } },
    },
  },
  payment: { select: { id: true, status: true, method: true, paidAt: true } },
} satisfies PrismaTypes.OrderSelect;

export async function listForSeller(
  sellerId: string,
  query: { status?: OrderStatus; q?: string; search?: string; page: number; limit: number }
) {
  const where = { sellerId, ...(query.status ? { status: query.status } : {}), ...buildSearchWhere(query.q, query.search) };
  const { skip, take } = toSkipTake(query);

  const [itemsRaw, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: sellerOrderSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  const items = itemsRaw.map(mapOrderDetails);

  return { items, meta: buildMeta(query, total) };
}

export async function exportCsvForSeller(
  sellerId: string,
  query: { status?: OrderStatus; q?: string; search?: string }
) {
  const where = { sellerId, ...(query.status ? { status: query.status } : {}), ...buildSearchWhere(query.q, query.search) };

  const orders = await prisma.order.findMany({
    where,
    select: sellerOrderSelect,
    orderBy: { createdAt: "desc" },
  });

  const header = "Order ID,Order Number,Nama Pembeli,Email,Tanggal,Total Barang,Total Harga,Status Pembayaran,Status Pengiriman\n";
  const rows = orders.map((o) => {
    const totalBarang = o.items.reduce((sum, i) => sum + i.quantity, 0);
    const paymentStatusStr = mapPaymentStatus(o.status, o.payment?.status, o.payment?.method);
    const shippingStatusStr = mapShippingStatus(o.status);
    const formattedDate = o.createdAt.toISOString();
    return `"${o.id}","${o.orderNumber}","${o.user.name}","${o.user.email}","${formattedDate}",${totalBarang},${Number(o.total)},"${paymentStatusStr}","${shippingStatusStr}"`;
  });

  return header + rows.join("\n");
}

export async function exportCsvForUser(
  userId: string,
  query: { status?: OrderStatus; q?: string; search?: string }
) {
  const where = { userId, ...(query.status ? { status: query.status } : {}), ...buildSearchWhere(query.q, query.search) };

  const orders = await prisma.order.findMany({
    where,
    select: orderSelect,
    orderBy: { createdAt: "desc" },
  });

  const header = "Order ID,Order Number,Nama Toko,Tanggal,Total Barang,Total Harga,Status Pembayaran,Status Pengiriman\n";
  const rows = orders.map((o) => {
    const totalBarang = o.items.reduce((sum, i) => sum + i.quantity, 0);
    const paymentStatusStr = mapPaymentStatus(o.status, o.payment?.status, o.payment?.method);
    const shippingStatusStr = mapShippingStatus(o.status);
    const formattedDate = o.createdAt.toISOString();
    return `"${o.id}","${o.orderNumber}","${o.seller.storeName}","${formattedDate}",${totalBarang},${Number(o.total)},"${paymentStatusStr}","${shippingStatusStr}"`;
  });

  return header + rows.join("\n");
}

export async function listAll(query: {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  page: number;
  limit: number;
}) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.paymentStatus ? { payment: { status: query.paymentStatus } } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.order.findMany({
      where,
      select: { ...sellerOrderSelect, seller: { select: { id: true, storeName: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.order.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function getForSeller(sellerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, sellerId },
    select: sellerOrderSelect,
  });
  if (!order) throw AppError.notFound("Order nggak ketemu.");
  return order;
}

export async function transition(
  actor: { userId: string; role: "BUYER" | "SELLER" | "ADMIN" },
  orderId: string,
  to: OrderStatus
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true, userId: true, sellerId: true },
  });
  if (!order) throw AppError.notFound("Order nggak ketemu.");

  await assertActorMayTransition(actor, order, to);

  if (!canTransitionStatus(order.status, to)) {
    throw AppError.conflict(
      `Tidak bisa mengubah status dari ${order.status} ke ${to}.`,
      "INVALID_STATUS_TRANSITION"
    );
  }

  return applyTransition(orderId, to);
}

async function assertActorMayTransition(
  actor: { userId: string; role: "BUYER" | "SELLER" | "ADMIN" },
  order: { userId: string; sellerId: string },
  to: OrderStatus
) {
  if (actor.role === "ADMIN") return;

  const isOwningSeller = async () => {
    const seller = await prisma.seller.findUnique({
      where: { userId: actor.userId },
      select: { id: true },
    });
    return Boolean(seller && seller.id === order.sellerId);
  };
  const isBuyer = order.userId === actor.userId;

  // PROCESSING dipegang penjual: dialah yang memutuskan orderan diterima dan
  // mulai disiapkan. Sebelumnya status ini jatuh ke pemeriksaan "harus
  // pembeli" di bawah, sehingga penjual selalu ditolak 403 dan orderan
  // mandek di dasbor mereka.
  if (to === "PROCESSING" || to === "SHIPPED" || to === "DELIVERED") {
    if (!(await isOwningSeller())) {
      throw AppError.forbidden("Hanya penjual order ini yang bisa mengubah status pengiriman.");
    }
    return;
  }

  // Membatalkan boleh dari dua sisi: pembeli berubah pikiran, atau penjual
  // menolak karena stok/alamat bermasalah.
  if (to === "CANCELLED") {
    if (isBuyer || (await isOwningSeller())) return;
    throw AppError.forbidden("Order ini bukan milik kamu.");
  }

  // Sisanya (COMPLETED) hanya pembeli: dialah yang memastikan barang diterima.
  if (!isBuyer) {
    throw AppError.forbidden("Order ini bukan milik kamu.");
  }
}

const BUYER_STATUS_NEWS: Partial<Record<OrderStatus, { title: string; message: string }>> = {
  PROCESSING: {
    title: "Pesanan lagi disiapkan",
    message: "Pembayaran diterima. Penjual lagi nyiapin barangmu.",
  },
  SHIPPED: {
    title: "Pesanan dikirim",
    message: "Barangmu udah jalan. Pantau terus ya.",
  },
  DELIVERED: {
    title: "Pesanan sampai",
    message: "Barang udah sampai. Kalau semuanya beres, selesaikan pesanannya ya.",
  },
  COMPLETED: {
    title: "Pesanan selesai",
    message: "Makasih udah belanja. Bagi ulasanmu buat bantu pembeli lain.",
  },
  CANCELLED: {
    title: "Pesanan dibatalkan",
    message: "Pesanan ini dibatalkan. Stok barangnya udah dikembalikan.",
  },
};

export async function applyTransition(orderId: string, to: OrderStatus) {
  let created: { id: string; userId: string } | null = null;
  let trackingEvent: unknown = null;
  let buyerId: string | null = null;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        status: true,
        userId: true,
        total: true,
        payment: { select: { method: true, status: true } },
        items: { select: { productId: true, quantity: true } },
        commissionAmount: true,
        orderNumber: true,
        seller: { select: { userId: true } },
      },
    });
    if (!order) throw AppError.notFound("Order nggak ketemu.");

    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status: to },
    });
    if (claimed.count === 0) {
      throw AppError.conflict("Status order sedang berubah, coba lagi.", "STATUS_RACE");
    }

    if (to === "CANCELLED") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { increment: item.quantity },
            ...(order.status === "PROCESSING"
              ? { soldCount: { decrement: item.quantity } }
              : {}),
          },
        });
      }
      if (order.payment?.method === "NEEDPAY" && order.payment.status === "PAID") {
        await refundForOrder(tx, order.userId, order.id, order.total);
      }
    }

    if (to === "PROCESSING") {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        });
      }
    }

    const data: PrismaTypes.OrderUpdateInput = { status: to };
    if (to === "DELIVERED") data.deliveredAt = new Date();
    if (to === "COMPLETED") {
      data.completedAt = new Date();
      // Ditandai lunas di transaksi yang sama dengan pengkreditannya, jadi
      // penyapuan berkala tidak akan membayar pesanan ini lagi.
      data.settledAt = new Date();
    }

    // Pesanan selesai berarti barang sudah dikonfirmasi diterima pembeli.
    // Baru di titik itu hasil penjualan disetorkan ke NeedPay penjual, sudah
    // dipotong komisi platform. Aman dari kredit ganda karena COMPLETED
    // adalah status terminal — tidak ada transisi yang bisa masuk dua kali.
    if (to === "COMPLETED") {
      const bersih = order.total.minus(order.commissionAmount);
      await creditSellerEarning(
        tx,
        order.seller.userId,
        order.id,
        bersih,
        `Hasil penjualan order ${order.orderNumber} (dipotong komisi platform)`
      );
    }

    const updated = await tx.order.update({ where: { id: orderId }, data, select: orderSelect });

    buyerId = order.userId;

    const stage = stageForStatus(to);
    if (stage) {
      trackingEvent = await addTrackingEvent(tx, {
        orderId: order.id,
        stage: stage.stage,
        description: stage.description,
      });
    }

    const news = BUYER_STATUS_NEWS[to];
    if (news) {
      created = await createNotification(tx, {
        userId: order.userId,
        type: "ORDER_STATUS",
        title: news.title,
        message: `${news.message} (Order ${updated.orderNumber})`,
        orderId: order.id,
      });
    }

    return updated;
  });

  if (created) await pushCreated([created]);
  if (trackingEvent && buyerId) pushTrackingEvent(buyerId, orderId, trackingEvent);
  return result;
}

export async function handlePaymentOutcome(orderId: string, outcome: "PAID" | "FAILED") {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) return null;

  const target: OrderStatus = outcome === "PAID" ? "PROCESSING" : "CANCELLED";
  if (!canTransitionStatus(order.status, target)) return null;

  try {
    return await applyTransition(orderId, target);
  } catch (error) {
    if (error instanceof AppError && error.code === "STATUS_RACE") return null;
    throw error;
  }
}