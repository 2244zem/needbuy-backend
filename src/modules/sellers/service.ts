import { Prisma, type SellerStatus } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import {
  SELF_PURCHASE_CODE,
  SELF_PURCHASE_MESSAGE,
  hasOwnStore,
} from "../../lib/selfPurchase";
import type { CreateSellerInput, ListSellersQuery, UpdateSellerInput } from "./schema";
import { PAID_ORDER_WHERE } from "../../lib/revenue";

const publicSellerSelect = {
  id: true,
  storeName: true,
  
  description: true,
  logoUrl: true,
  
  address: true,
  vacationMode: true,
  rating: true,
  status: true,
  createdAt: true,
} as const;

const ownSellerSelect = {
  ...publicSellerSelect,
  businessEmail: true,
  phone: true,
  updatedAt: true,
} as const;

export async function getOwn(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { ...ownSellerSelect, _count: { select: { products: true } } },
  });
  if (!seller) throw AppError.notFound("Kamu belum punya toko.");
  return seller;
}

export async function createSeller(userId: string, input: CreateSellerInput) {
  const existing = await prisma.seller.findUnique({ where: { userId } });
  if (existing) throw AppError.conflict("Akun ini udah punya toko.", "SELLER_ALREADY_EXISTS");

  return prisma.$transaction(async (tx) => {
    const seller = await tx.seller.create({
      data: {
        userId,
        storeName: input.storeName,
        address: input.address,
        phone: input.phone,
        description: input.description ?? null,
        logoUrl: input.logoUrl ?? null,
        businessEmail: input.businessEmail ?? null,
      },
      select: ownSellerSelect,
    });
    await tx.user.update({ where: { id: userId }, data: { role: "SELLER" } });
    return seller;
  });
}

export async function search(query: ListSellersQuery) {
  const where: Prisma.SellerWhereInput = {
    status: "ACTIVE",
    ...(query.q
      ? {
          OR: [
            { storeName: { contains: query.q, mode: "insensitive" } },
            { description: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [items, total] = await Promise.all([
    prisma.seller.findMany({
      where,
      select: { ...publicSellerSelect, _count: { select: { products: true } } },
      
      orderBy: [{ rating: "desc" }, { storeName: "asc" }],
      skip,
      take,
    }),
    prisma.seller.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function getById(id: string) {
  const seller = await prisma.seller.findUnique({
    where: { id },
    select: { ...publicSellerSelect, _count: { select: { products: true, followers: true } } },
  });
  if (!seller) throw AppError.notFound("Toko nggak ketemu.");
  return seller;
}

export async function updateOwn(userId: string, data: UpdateSellerInput) {
  const seller = await prisma.seller.findUnique({ where: { userId }, select: { id: true } });
  if (!seller) throw AppError.notFound("Kamu belum punya toko.");

  return prisma.seller.update({
    where: { id: seller.id },
    
    data: {
      ...(data.storeName !== undefined ? { storeName: data.storeName } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.address !== undefined ? { address: data.address } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.logoUrl !== undefined ? { logoUrl: data.logoUrl } : {}),
      ...(data.businessEmail !== undefined ? { businessEmail: data.businessEmail } : {}),
      ...(data.vacationMode !== undefined ? { vacationMode: data.vacationMode } : {}),
    },
    select: ownSellerSelect,
  });
}

export async function setStatus(sellerId: string, status: SellerStatus) {
  const seller = await prisma.seller.findUnique({
    where: { id: sellerId },
    select: { id: true, status: true },
  });
  if (!seller) throw AppError.notFound("Toko nggak ketemu.");

  if (seller.status === status) {
    return { seller: await getById(sellerId), changed: false, previousStatus: seller.status };
  }

  const updated = await prisma.seller.update({
    where: { id: sellerId },
    data: { status },
    select: publicSellerSelect,
  });

  return { seller: updated, changed: true, previousStatus: seller.status };
}

export async function listForAdmin(query: {
  status?: SellerStatus;
  minRating?: number;
  q?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.SellerWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.minRating !== undefined ? { rating: { gte: query.minRating } } : {}),
    ...(query.q ? { storeName: { contains: query.q, mode: "insensitive" } } : {}),
  };

  const { skip, take } = toSkipTake(query);
  const [rows, total] = await Promise.all([
    prisma.seller.findMany({
      where,
      select: {
        id: true,
        storeName: true,
        rating: true,
        status: true,
        vacationMode: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        _count: { select: { products: true, orders: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.seller.count({ where }),
  ]);

  const revenueRows = rows.length
    ? await prisma.order.groupBy({
        by: ["sellerId"],
        where: { sellerId: { in: rows.map((row) => row.id) }, ...PAID_ORDER_WHERE },
        _sum: { total: true, commissionAmount: true },
      })
    : [];
  const revenueBySeller = new Map(
    revenueRows.map((row) => [
      row.sellerId,
      {
        gross: Number(row._sum.total ?? 0),
        commission: Number(row._sum.commissionAmount ?? 0),
      },
    ])
  );

  const items = rows.map((row) => {
    const money = revenueBySeller.get(row.id) ?? { gross: 0, commission: 0 };
    return {
    id: row.id,
    storeName: row.storeName,
    owner: row.user.name,
    ownerEmail: row.user.email,
    products: row._count.products,
    orders: row._count.orders,
    
    revenue: money.gross,
    
    commission: money.commission,
    
    netRevenue: Math.round((money.gross - money.commission) * 100) / 100,
    rating: Number(row.rating),
    
    status: row.status,
    vacationMode: row.vacationMode,
    createdAt: row.createdAt,
    };
  });

  return { items, meta: buildMeta(query, total) };
}

export async function follow(userId: string, sellerId: string) {
  const seller = await prisma.seller.findUnique({ where: { id: sellerId }, select: { id: true } });
  if (!seller) throw AppError.notFound("Toko nggak ketemu.");

  await prisma.sellerFollow.upsert({
    where: { userId_sellerId: { userId, sellerId } },
    create: { userId, sellerId },
    update: {},
  });

  return followState(userId, sellerId);
}

export async function unfollow(userId: string, sellerId: string) {
  await prisma.sellerFollow.deleteMany({ where: { userId, sellerId } });
  return followState(userId, sellerId);
}

async function followState(userId: string, sellerId: string) {
  const [followerCount, mine] = await Promise.all([
    prisma.sellerFollow.count({ where: { sellerId } }),
    prisma.sellerFollow.findUnique({
      where: { userId_sellerId: { userId, sellerId } },
      select: { id: true },
    }),
  ]);
  return { sellerId, following: mine !== null, followerCount };
}

export async function ownSellerId(
  userId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma
): Promise<string | null> {
  const seller = await client.seller.findUnique({
    where: { userId },
    select: { id: true },
  });
  return seller?.id ?? null;
}

/** Menolak transaksi apa pun yang menyentuh toko milik user itu sendiri. */
export async function assertNotOwnStore(
  userId: string,
  sellerIds: Iterable<string>,
  client: Prisma.TransactionClient | typeof prisma = prisma,
  message: string = SELF_PURCHASE_MESSAGE
) {
  const mine = await ownSellerId(userId, client);
  if (hasOwnStore(mine, sellerIds)) {
    throw AppError.forbidden(message, SELF_PURCHASE_CODE);
  }
}

export async function requireOwnSeller(userId: string) {
  const seller = await prisma.seller.findUnique({
    where: { userId },
    select: { id: true, status: true },
  });
  if (!seller) throw AppError.forbidden("Akun kamu belum terdaftar sebagai penjual.");
  if (seller.status === "SUSPENDED") {
    throw AppError.forbidden("Toko kamu sedang disuspend.", "SELLER_SUSPENDED");
  }
  return seller;
}
