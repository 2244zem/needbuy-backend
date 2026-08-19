import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { logger } from "../../config/logger";
import { createFor as createNotification, pushCreated } from "../notifications/service";
import type { ListMessagesQuery } from "./schema";

const messageSelect = {
  id: true,
  senderId: true,
  body: true,
  imageUrl: true,
  orderId: true,
  createdAt: true,
  readAt: true,
} satisfies Prisma.MessageSelect;

const conversationSelect = {
  id: true,
  createdAt: true,
  lastMessageAt: true,
  
  buyer: { select: { id: true, name: true, avatarUrl: true } },
  seller: {
    select: {
      id: true,
      storeName: true,
      userId: true,
      logoUrl: true,
      user: { select: { avatarUrl: true } },
    },
  },
  messages: {
    select: messageSelect,
    orderBy: { createdAt: "desc" },
    take: 1,
  },
} satisfies Prisma.ConversationSelect;

async function requireParticipant(userId: string, conversationId: string) {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ buyerId: userId }, { seller: { userId } }] },
    select: {
      id: true,
      buyerId: true,
      buyer: { select: { name: true } },
      seller: { select: { userId: true, storeName: true } },
    },
  });
  if (!conversation) throw AppError.notFound("Percakapan nggak ketemu.");
  return conversation;
}

/**
 * `as` menentukan percakapan mana yang dilihat, dan ini penting: satu akun
 * bisa sekaligus jadi pembeli dan pemilik toko. Sebelumnya semua percakapan
 * dikembalikan tanpa pandang peran, sehingga kotak masuk pembeli ikut memuat
 * percakapan tokonya sendiri — dan karena halaman itu selalu menampilkan nama
 * toko, yang muncul adalah nama toko sendiri di setiap baris.
 */
export async function listConversations(userId: string, as?: "buyer" | "seller") {
  const scope =
    as === "buyer"
      ? { buyerId: userId }
      : as === "seller"
        ? { seller: { userId } }
        : { OR: [{ buyerId: userId }, { seller: { userId } }] };

  const rows = await prisma.conversation.findMany({
    where: scope,
    orderBy: { lastMessageAt: "desc" },
    select: conversationSelect,
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: rows.map((row) => row.id) },
      senderId: { not: userId },
      readAt: null,
    },
    _count: { _all: true },
  });
  const unreadBy = new Map(unreadCounts.map((row) => [row.conversationId, row._count._all]));

  return rows.map(({ messages, ...conversation }) => ({
    ...conversation,
    ...counterpartOf(conversation, userId),
    lastMessage: messages[0] ?? null,
    unreadCount: unreadBy.get(conversation.id) ?? 0,
  }));
}

type ConversationSides = {
  buyer: { id: string; name: string | null; avatarUrl: string | null };
  seller: {
    id: string;
    storeName: string | null;
    userId: string;
    logoUrl: string | null;
    user: { avatarUrl: string | null } | null;
  };
};

/**
 * Siapa lawan bicaranya ditentukan di sini, bukan ditebak frontend. Halaman
 * chat dulu memilih sisi secara tetap — pembeli selalu menampilkan toko,
 * penjual selalu menampilkan pembeli — sehingga begitu perannya terbalik yang
 * tampil adalah diri sendiri.
 */
export function counterpartOf(conversation: ConversationSides, viewerId: string) {
  const viewerIsBuyer = conversation.buyer.id === viewerId;
  return {
    viewerRole: viewerIsBuyer ? ("BUYER" as const) : ("SELLER" as const),
    counterpart: viewerIsBuyer
      ? {
          name: conversation.seller.storeName ?? "Toko",
          avatarUrl: conversation.seller.logoUrl ?? conversation.seller.user?.avatarUrl ?? null,
        }
      : {
          name: conversation.buyer.name ?? "Pembeli",
          avatarUrl: conversation.buyer.avatarUrl ?? null,
        },
  };
}

export async function startConversation(userId: string, sellerId: string) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, userId: true },
  });
  if (!seller) throw AppError.notFound("Penjual nggak ketemu.");
  if (seller.userId === userId) {
    throw AppError.badRequest("Tidak bisa memulai percakapan dengan toko sendiri.");
  }

  const conversation = await prisma.conversation.upsert({
    where: { buyerId_sellerId: { buyerId: userId, sellerId } },
    update: {},
    create: { buyerId: userId, sellerId },
    select: conversationSelect,
  });

  const { messages, ...rest } = conversation;
  return {
    ...rest,
    ...counterpartOf(rest, userId),
    lastMessage: messages[0] ?? null,
    unreadCount: 0,
  };
}

export async function listMessages(
  userId: string,
  conversationId: string,
  query: ListMessagesQuery
) {
  await requireParticipant(userId, conversationId);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(query.after ? { createdAt: { gt: query.after } } : {}),
    },
    orderBy: { createdAt: query.after ? "asc" : "desc" },
    take: query.limit,
    select: messageSelect,
  });

  await prisma.message.updateMany({
    where: { conversationId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  });

  return query.after ? messages : messages.reverse();
}

export async function sendMessage(
  userId: string,
  conversationId: string,
  input: { body?: string; imageUrl?: string }
) {
  const conversation = await requireParticipant(userId, conversationId);

  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        body: input.body ?? null,
        imageUrl: input.imageUrl ?? null,
      },
      select: messageSelect,
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date() },
      select: { id: true },
    }),
  ]);

  await notifyCounterpart(conversation, userId, input);

  return message;
}

// Notifikasi dikirim ke lawan bicara, bukan ke pengirim. Sengaja di luar
// transaksi pesan: pesan yang sudah tersimpan tidak boleh ikut gagal hanya
// karena notifikasinya bermasalah.
async function notifyCounterpart(
  conversation: {
    buyerId: string;
    buyer: { name: string | null };
    seller: { userId: string; storeName: string | null };
  },
  senderId: string,
  input: { body?: string; imageUrl?: string }
) {
  const dariPembeli = senderId === conversation.buyerId;
  const recipientId = dariPembeli ? conversation.seller.userId : conversation.buyerId;
  if (recipientId === senderId) return;

  // Judul menyebut pengirimnya. "Pesan baru" saja tidak memberi tahu apa pun
  // yang belum terbaca dari label notifikasinya sendiri.
  const pengirim = dariPembeli
    ? conversation.buyer.name?.trim()
    : conversation.seller.storeName?.trim();

  const preview = input.body?.trim()
    ? input.body.trim().slice(0, 80)
    : input.imageUrl
      ? "Mengirim sebuah gambar."
      : "Mengirim sebuah pesan.";

  try {
    const created = await createNotification(prisma, {
      userId: recipientId,
      type: "CHAT",
      title: pengirim ? `Pesan dari ${pengirim}` : "Pesan baru",
      message: preview,
    });
    await pushCreated([created]);
  } catch (error) {
    logger.error({ err: error, conversationId: conversation.buyerId }, "gagal kirim notifikasi chat");
  }
}

export async function sendOrderCard(input: {
  buyerId: string;
  sellerId: string;
  orderId: string;
  orderNumber: string;
}) {
  const conversation = await prisma.conversation.upsert({
    where: { buyerId_sellerId: { buyerId: input.buyerId, sellerId: input.sellerId } },
    update: { lastMessageAt: new Date() },
    create: { buyerId: input.buyerId, sellerId: input.sellerId },
    select: { id: true },
  });

  return prisma.message.create({
    data: {
      conversationId: conversation.id,
      senderId: input.buyerId,
      body: `Halo, saya baru pesan #${input.orderNumber}. Mohon diproses ya.`,
      orderId: input.orderId,
    },
    select: messageSelect,
  });
}
