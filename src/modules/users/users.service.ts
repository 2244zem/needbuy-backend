import type { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { issueRefreshToken, signAccessToken } from "../auth/auth.service";
import type { ChangePasswordInput, UpdateProfileInput } from "./users.schema";

const publicUserSelect = {
  id: true,
  username: true,
  name: true,
  email: true,
  phone: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...publicUserSelect,
      seller: { select: { id: true, storeName: true, status: true, rating: true } },
      _count: { select: { orders: true, needs: true, addresses: true } },
    },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");
  return user;
}

export async function listUsers(query: {
  role?: UserRole;
  q?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.UserWhereInput = {
    ...(query.role ? { role: query.role } : {}),
    ...(query.q
      ? {
          OR: [
            { username: { contains: query.q, mode: "insensitive" } },
            { name: { contains: query.q, mode: "insensitive" } },
            { email: { contains: query.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        ...publicUserSelect,
        seller: {
          select: {
            id: true,
            storeName: true,
            status: true,
            rating: true,
            _count: { select: { products: true, orders: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.user.count({ where }),
  ]);

  const userIds = rows.map((row) => row.id);
  const sellerIds = rows.flatMap((row) => (row.seller ? [row.seller.id] : []));

  const [spendRows, sellerRevenueRows] = await Promise.all([
    userIds.length
      ? prisma.order.groupBy({
          by: ["userId"],
          where: { userId: { in: userIds }, payment: { status: "PAID" } },
          _sum: { total: true },
          _count: { _all: true },
        })
      : [],
    sellerIds.length
      ? prisma.order.groupBy({
          by: ["sellerId"],
          where: { sellerId: { in: sellerIds }, payment: { status: "PAID" } },
          _sum: { total: true },
        })
      : [],
  ]);

  const spendByUser = new Map(spendRows.map((row) => [row.userId, row]));
  const revenueBySeller = new Map(
    sellerRevenueRows.map((row) => [row.sellerId, Number(row._sum.total ?? 0)])
  );

  const items = rows.map((row) => {
    const spend = spendByUser.get(row.id);
    return {
      ...row,
      totalOrders: spend?._count._all ?? 0,
      totalSpent: Number(spend?._sum.total ?? 0),
      seller: row.seller
        ? {
            id: row.seller.id,
            storeName: row.seller.storeName,
            status: row.seller.status,
            rating: Number(row.seller.rating),
            products: row.seller._count.products,
            orders: row.seller._count.orders,
            revenue: revenueBySeller.get(row.seller.id) ?? 0,
          }
        : null,
    };
  });

  return { items, meta: buildMeta(query, total) };
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  return prisma.user.update({
    where: { id: userId },
    
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    select: publicUserSelect,
  });
}

export async function changePassword(userId: string, input: ChangePasswordInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, passwordHash: true },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");

  if (!user.passwordHash) {
    throw AppError.badRequest("Akun terdaftar menggunakan social login dan nggak memiliki password.");
  }

  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) {
    throw AppError.conflict("Password saat ini salah.", "INVALID_CURRENT_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_ROUNDS);

  const revoked = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    const result = await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  });

  const accessToken = signAccessToken({ id: user.id, role: user.role });
  const refreshToken = await issueRefreshToken(user.id);

  logger.info({ userId, revokedSessions: revoked }, "password changed");

  return {
    changed: true,
    revokedSessions: revoked,
    accessToken,
    refreshToken,
    expiresIn: env.JWT_EXPIRES_IN,
    message: "Password diganti. Sesi di perangkat lain dicabut.",
  };
}
