import type { Prisma, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { logger } from "../../config/logger";
import { prisma } from "../../config/prisma";
import { AppError } from "../../lib/apiError";
import { buildMeta, toSkipTake } from "../../lib/pagination";
import { issueRefreshToken, signAccessToken } from "../auth/auth.service";
import type { ChangePasswordInput, UpdateProfileInput } from "./users.schema";
import { PAID_ORDER_WHERE } from "../../lib/revenue";

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
      // Diambil hanya untuk diturunkan jadi boolean di bawah. Hash-nya sendiri
      // tidak pernah ikut keluar dari fungsi ini.
      passwordHash: true,
      emailVerifiedAt: true,
      authProvider: true,
      seller: { select: { id: true, storeName: true, status: true, rating: true } },
      _count: { select: { orders: true, needs: true, addresses: true } },
    },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");

  const { passwordHash, ...rest } = user;
  return {
    ...rest,
    // Dipakai UI untuk memilih antara "Atur Password" dan "Ganti Password".
    // Akun yang mendaftar lewat Google tidak punya password sama sekali.
    hasPassword: Boolean(passwordHash),
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

/**
 * Membuat password untuk akun yang belum punya — hampir selalu akun Google.
 *
 * Tidak meminta password lama karena memang tidak ada. Yang dijadikan bukti
 * kepemilikan adalah email terverifikasi: tanpa itu, siapa pun yang sempat
 * memegang sesi bisa memasang password dan mengambil alih akun.
 *
 * Sebelumnya tidak ada jalan sama sekali — changePassword menolak akun tanpa
 * password, dan tidak ada endpoint untuk membuatnya, jadi user Google terkunci
 * selamanya pada satu cara masuk.
 */
export async function setPassword(userId: string, newPassword: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, passwordHash: true, emailVerifiedAt: true },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");

  if (user.passwordHash) {
    throw AppError.conflict(
      "Akun ini udah punya password. Pakai ganti password ya.",
      "PASSWORD_ALREADY_SET"
    );
  }
  if (!user.emailVerifiedAt) {
    throw AppError.badRequest(
      "Verifikasi email kamu dulu sebelum bikin password.",
      "EMAIL_NOT_VERIFIED"
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { hasPassword: true };
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
        // Admin butuh tahu mana akun yang emailnya sudah terbukti aktif.
        // Sebelumnya kolom Status pembeli dipaku "Aktif" karena User memang
        // tidak punya status apa pun, jadi kolomnya tidak berarti apa-apa.
        emailVerifiedAt: true,
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
          where: { userId: { in: userIds }, ...PAID_ORDER_WHERE },
          _sum: { total: true },
          _count: { _all: true },
        })
      : [],
    sellerIds.length
      ? prisma.order.groupBy({
          by: ["sellerId"],
          where: { sellerId: { in: sellerIds }, ...PAID_ORDER_WHERE },
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
    const { emailVerifiedAt, ...sisa } = row;
    return {
      ...sisa,
      emailVerified: Boolean(emailVerifiedAt),
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
    select: { id: true, email: true, role: true, passwordHash: true, emailVerifiedAt: true },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");

  // Akun tanpa password diarahkan ke jalur pembuatan, bukan dibiarkan buntu.
  // Dulu pesannya hanya memberitahu bahwa passwordnya tidak ada, tanpa
  // memberi tahu apa yang harus dilakukan — dan memang belum ada jalannya.
  if (!user.passwordHash) {
    throw AppError.badRequest(
      "Akun ini belum punya password. Atur password dulu ya.",
      "PASSWORD_NOT_SET"
    );
  }

  // Ganti password wajib lewat email terverifikasi: kalau emailnya belum
  // terbukti milik user, jalur pemulihan lewat email juga tidak bisa dipercaya.
  if (!user.emailVerifiedAt) {
    throw AppError.badRequest(
      "Verifikasi email kamu dulu sebelum ganti password.",
      "EMAIL_NOT_VERIFIED"
    );
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
