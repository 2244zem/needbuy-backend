import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { withExternalCall } from "../../config/logger";
import { snap } from "../../config/midtrans";
import { AppError } from "../../lib/apiError";
import { generateTopupOrderId } from "../../lib/needpay";
import { buildMeta, toSkipTake } from "../../lib/pagination";

const txSelect = {
  id: true,
  type: true,
  status: true,
  amount: true,
  balanceAfter: true,
  orderId: true,
  note: true,
  bankName: true,
  bankAccount: true,
  bankAccountName: true,
  handledAt: true,
  snapToken: true,
  snapRedirectUrl: true,
  midtransOrderId: true,
  createdAt: true,
} satisfies Prisma.WalletTransactionSelect;

export async function ensureWallet(userId: string, tx: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await tx.wallet.findUnique({
    where: { userId },
    select: { id: true, balance: true },
  });
  if (existing) return existing;

  return tx.wallet.create({
    data: { userId },
    select: { id: true, balance: true },
  });
}

export async function getWallet(userId: string) {
  const wallet = await ensureWallet(userId);
  return { id: wallet.id, balance: wallet.balance };
}

export async function listTransactions(
  userId: string,
  query: { page: number; limit: number }
) {
  const wallet = await ensureWallet(userId);
  const { skip, take } = toSkipTake(query);
  const where = { walletId: wallet.id };

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      select: txSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function startTopup(userId: string, amount: number) {
  const wallet = await ensureWallet(userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, phone: true },
  });
  if (!user) throw AppError.notFound("User nggak ketemu.");

  const midtransOrderId = generateTopupOrderId();
  const pending = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "TOPUP",
      status: "PENDING",
      amount: new Prisma.Decimal(amount),
      midtransOrderId,
      note: "Top up saldo NeedPay",
    },
    select: { id: true },
  });

  try {
    const transaction = await withExternalCall("midtrans", "snap.createTransaction", () =>
      snap.createTransaction({
        transaction_details: { order_id: midtransOrderId, gross_amount: amount },
        item_details: [
          { id: "NEEDPAY_TOPUP", price: amount, quantity: 1, name: "Top up saldo NeedPay" },
        ],
        customer_details: {
          first_name: user.name,
          email: user.email,
          ...(user.phone ? { phone: user.phone } : {}),
        },
      })
    );

    return prisma.walletTransaction.update({
      where: { id: pending.id },
      data: { snapToken: transaction.token, snapRedirectUrl: transaction.redirect_url },
      select: txSelect,
    });
  } catch (error) {
    await prisma.walletTransaction.update({
      where: { id: pending.id },
      data: { status: "FAILED" },
    });
    throw error;
  }
}

export async function creditTopup(
  midtransOrderId: string,
  payload: Prisma.InputJsonValue
): Promise<{ credited: boolean; reason?: string }> {
  return prisma.$transaction(async (tx) => {
    const row = await tx.walletTransaction.findUnique({
      where: { midtransOrderId },
      select: { id: true, walletId: true, amount: true, status: true, type: true },
    });
    if (!row) return { credited: false, reason: "TOPUP_NOT_FOUND" };
    if (row.type !== "TOPUP") return { credited: false, reason: "NOT_A_TOPUP" };

    const claimed = await tx.walletTransaction.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: { status: "SUCCESS", rawResponse: payload },
    });
    if (claimed.count === 0) {
      await tx.walletTransaction.update({
        where: { id: row.id },
        data: { rawResponse: payload },
      });
      return { credited: false, reason: "ALREADY_SETTLED" };
    }

    const wallet = await tx.wallet.update({
      where: { id: row.walletId },
      data: { balance: { increment: row.amount } },
      select: { balance: true },
    });

    await tx.walletTransaction.update({
      where: { id: row.id },
      data: { balanceAfter: wallet.balance },
    });

    return { credited: true };
  });
}

export async function failTopup(
  midtransOrderId: string,
  status: "FAILED" | "EXPIRED",
  payload: Prisma.InputJsonValue
) {
  const updated = await prisma.walletTransaction.updateMany({
    where: { midtransOrderId, status: "PENDING" },
    data: { status, rawResponse: payload },
  });
  return { updated: updated.count > 0 };
}

export async function debitForOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  amount: Prisma.Decimal,
  note: string
) {
  const wallet = await ensureWallet(userId, tx);

  const claimed = await tx.wallet.updateMany({
    where: { id: wallet.id, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });
  if (claimed.count === 0) {
    throw AppError.badRequest(
      "Saldo NeedPay kamu nggak cukup buat pesanan ini.",
      "INSUFFICIENT_BALANCE"
    );
  }

  const fresh = await tx.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    select: { balance: true },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "PAYMENT",
      status: "SUCCESS",
      amount,
      balanceAfter: fresh.balance,
      orderId,
      note,
    },
  });

  return { balance: fresh.balance };
}

/**
 * Menyetorkan hasil penjualan ke NeedPay penjual, sudah dipotong komisi.
 *
 * Masuk otomatis tanpa pengajuan — yang butuh persetujuan admin hanya
 * penarikan ke rekening bank. Sebelumnya komisi cuma dicatat di kolom
 * `orders.commission_amount` untuk laporan dan tidak ada mutasi dompet sama
 * sekali, jadi penjual tidak pernah benar-benar menerima uangnya.
 *
 * Dipanggil sekali saja, saat pesanan berpindah ke COMPLETED. Transisi itu
 * terminal (COMPLETED tidak punya tujuan berikutnya) sehingga tidak ada jalan
 * untuk mengkredit dua kali.
 */
export async function creditSellerEarning(
  tx: Prisma.TransactionClient,
  sellerUserId: string,
  orderId: string,
  amount: Prisma.Decimal,
  note: string
) {
  // Pesanan bernilai nol atau yang komisinya menghabiskan seluruh nilai tidak
  // menghasilkan mutasi: baris dompet bersaldo nol cuma bikin riwayat berisik.
  if (amount.lte(new Prisma.Decimal(0))) return null;

  const wallet = await ensureWallet(sellerUserId, tx);

  await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amount } },
  });

  const fresh = await tx.wallet.findUniqueOrThrow({
    where: { id: wallet.id },
    select: { balance: true },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "EARNING",
      status: "SUCCESS",
      amount,
      balanceAfter: fresh.balance,
      orderId,
      note,
    },
  });

  return { balance: fresh.balance };
}

export async function refundForOrder(
  tx: Prisma.TransactionClient,
  userId: string,
  orderId: string,
  amount: Prisma.Decimal
) {
  const already = await tx.walletTransaction.findFirst({
    where: { orderId, type: "REFUND" },
    select: { id: true },
  });
  if (already) return { refunded: false as const };

  const wallet = await ensureWallet(userId, tx);
  const updated = await tx.wallet.update({
    where: { id: wallet.id },
    data: { balance: { increment: amount } },
    select: { balance: true },
  });

  await tx.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "REFUND",
      status: "SUCCESS",
      amount,
      balanceAfter: updated.balance,
      orderId,
      note: "Pengembalian saldo, order dibatalkan",
    },
  });

  return { refunded: true as const, balance: updated.balance };
}

export async function requestWithdrawal(
  userId: string,
  input: { amount: number; bankName: string; bankAccount: string; bankAccountName: string }
) {
  const amount = new Prisma.Decimal(input.amount);

  return prisma.$transaction(async (tx) => {
    const wallet = await ensureWallet(userId, tx);

    const claimed = await tx.wallet.updateMany({
      where: { id: wallet.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (claimed.count === 0) {
      throw AppError.badRequest(
        "Saldo NeedPay kamu nggak cukup buat ditarik segitu.",
        "INSUFFICIENT_BALANCE"
      );
    }

    const fresh = await tx.wallet.findUniqueOrThrow({
      where: { id: wallet.id },
      select: { balance: true },
    });

    return tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        status: "PENDING",
        amount,
        balanceAfter: fresh.balance,
        bankName: input.bankName,
        bankAccount: input.bankAccount,
        bankAccountName: input.bankAccountName,
        note: "Menunggu persetujuan admin",
      },
      select: txSelect,
    });
  });
}

const withdrawalSelect = {
  ...txSelect,
  handledById: true,
  wallet: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          seller: { select: { id: true, storeName: true } },
        },
      },
    },
  },
} satisfies Prisma.WalletTransactionSelect;

export async function listWithdrawals(query: {
  status?: "PENDING" | "SUCCESS" | "FAILED";
  page: number;
  limit: number;
}) {
  const where: Prisma.WalletTransactionWhereInput = {
    type: "WITHDRAWAL",
    ...(query.status ? { status: query.status } : {}),
  };
  const { skip, take } = toSkipTake(query);

  const [items, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      select: withdrawalSelect,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return { items, meta: buildMeta(query, total) };
}

export async function decideWithdrawal(
  adminUserId: string,
  id: string,
  action: "APPROVE" | "REJECT",
  reason?: string
) {
  return prisma.$transaction(async (tx) => {
    const row = await tx.walletTransaction.findUnique({
      where: { id },
      select: { id: true, walletId: true, amount: true, type: true },
    });
    if (!row || row.type !== "WITHDRAWAL") {
      throw AppError.notFound("Permintaan penarikan nggak ketemu.");
    }

    const claimed = await tx.walletTransaction.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: action === "APPROVE" ? "SUCCESS" : "FAILED",
        handledById: adminUserId,
        handledAt: new Date(),
        note:
          action === "APPROVE"
            ? "Disetujui admin, dana ditransfer"
            : `Ditolak admin${reason ? `: ${reason}` : ""}`,
      },
    });
    if (claimed.count === 0) {
      throw AppError.conflict("Penarikan ini udah diproses.", "WITHDRAWAL_ALREADY_HANDLED");
    }

    if (action === "REJECT") {
      const wallet = await tx.wallet.update({
        where: { id: row.walletId },
        data: { balance: { increment: row.amount } },
        select: { balance: true },
      });
      
      await tx.walletTransaction.update({
        where: { id: row.id },
        data: { balanceAfter: wallet.balance },
      });
    }

    return tx.walletTransaction.findUniqueOrThrow({
      where: { id: row.id },
      select: withdrawalSelect,
    });
  });
}