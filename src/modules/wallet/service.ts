import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { env } from "../../config/env";
import { prisma } from "../../config/prisma";
import { logger, withExternalCall } from "../../config/logger";
import { snap } from "../../config/midtrans";
import { AppError } from "../../lib/apiError";
import { generateTopupOrderId } from "../../lib/needpay";
import { buildMeta, toSkipTake } from "../../lib/pagination";

// Nomor rekening dan PIN ikut dibawa karena hampir semua pemakai ensureWallet
// membutuhkannya; hash PIN tidak pernah dikirim ke klien, hanya dibandingkan.
const walletSelect = {
  id: true,
  balance: true,
  accountNumber: true,
  pinHash: true,
} satisfies Prisma.WalletSelect;

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
    select: walletSelect,
  });
  if (existing) return existing;

  return tx.wallet.create({
    data: { userId },
    select: walletSelect,
  });
}

export async function getWallet(userId: string) {
  const wallet = await ensureWallet(userId);
  // Nomor rekening ikut dikirim supaya bisa ditampilkan di bawah saldo dan
  // disebut orang lain saat transfer. Hash PIN sengaja tidak ikut — yang
  // dibutuhkan klien hanya tahu sudah diatur atau belum.
  return {
    id: wallet.id,
    balance: wallet.balance,
    accountNumber: wallet.accountNumber,
    hasPin: Boolean(wallet.pinHash),
  };
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
// ── PIN transfer ─────────────────────────────────────────────────────────────

/** Menutupi nomor rekening selain empat digit terakhir. */
function samarkan(nomor: string): string {
  return nomor.length <= 4 ? nomor : `${"*".repeat(nomor.length - 4)}${nomor.slice(-4)}`;
}

export async function getPinStatus(userId: string) {
  const wallet = await ensureWallet(userId);
  return { hasPin: Boolean(wallet.pinHash) };
}

/**
 * Mengatur atau mengganti PIN transfer.
 *
 * PIN lama wajib disertakan kalau sudah pernah dibuat — tanpa itu, siapa pun
 * yang sempat memegang sesi bisa memasang PIN baru dan menguras saldo.
 */
export async function setPin(userId: string, newPin: string, currentPin?: string) {
  const wallet = await ensureWallet(userId);

  if (wallet.pinHash) {
    if (!currentPin) {
      throw AppError.badRequest("Masukkan PIN lama kamu dulu.", "CURRENT_PIN_REQUIRED");
    }
    const cocok = await bcrypt.compare(currentPin, wallet.pinHash);
    if (!cocok) throw AppError.conflict("PIN lama salah.", "INVALID_PIN");
  }

  const pinHash = await bcrypt.hash(newPin, env.BCRYPT_ROUNDS);
  await prisma.wallet.update({ where: { id: wallet.id }, data: { pinHash } });
  return { hasPin: true };
}

// ── Transfer antar-pengguna ──────────────────────────────────────────────────

/** Mencari pemilik sebuah nomor rekening, buat dikonfirmasi sebelum kirim. */
export async function lookupAccount(accountNumber: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { accountNumber },
    select: { accountNumber: true, user: { select: { name: true } } },
  });
  if (!wallet) throw AppError.notFound("Nomor rekening NeedPay nggak ketemu.");
  return { accountNumber: wallet.accountNumber, name: wallet.user.name };
}

/**
 * Memindahkan saldo antar-dompet dalam satu transaksi.
 *
 * Pengurangan saldo pengirim memakai updateMany bersyarat `balance >= amount`,
 * bukan baca-lalu-tulis: dua transfer yang berjalan bersamaan tidak bisa
 * sama-sama lolos dan membuat saldo minus.
 */
export async function transfer(
  senderUserId: string,
  input: { toAccountNumber: string; amount: number; pin: string; note?: string }
) {
  const amount = new Prisma.Decimal(input.amount);
  if (amount.lte(new Prisma.Decimal(0))) {
    throw AppError.badRequest("Nominal transfer harus lebih dari nol.", "INVALID_AMOUNT");
  }

  const pengirim = await ensureWallet(senderUserId);
  if (!pengirim.pinHash) {
    throw AppError.badRequest("Atur PIN NeedPay kamu dulu sebelum transfer.", "PIN_NOT_SET");
  }
  const pinCocok = await bcrypt.compare(input.pin, pengirim.pinHash);
  if (!pinCocok) throw AppError.conflict("PIN salah.", "INVALID_PIN");

  const penerima = await prisma.wallet.findUnique({
    where: { accountNumber: input.toAccountNumber },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });
  if (!penerima) throw AppError.notFound("Nomor rekening tujuan nggak ketemu.");
  if (penerima.id === pengirim.id) {
    throw AppError.badRequest("Nggak bisa transfer ke rekening sendiri.", "SELF_TRANSFER");
  }

  return prisma.$transaction(async (tx) => {
    const terpotong = await tx.wallet.updateMany({
      where: { id: pengirim.id, balance: { gte: amount } },
      data: { balance: { decrement: amount } },
    });
    if (terpotong.count === 0) {
      throw AppError.badRequest("Saldo NeedPay kamu nggak cukup.", "INSUFFICIENT_BALANCE");
    }

    await tx.wallet.update({
      where: { id: penerima.id },
      data: { balance: { increment: amount } },
    });

    const [saldoPengirim, saldoPenerima] = await Promise.all([
      tx.wallet.findUniqueOrThrow({ where: { id: pengirim.id }, select: { balance: true } }),
      tx.wallet.findUniqueOrThrow({ where: { id: penerima.id }, select: { balance: true } }),
    ]);

    const catatan = input.note?.trim();
    await tx.walletTransaction.createMany({
      data: [
        {
          walletId: pengirim.id,
          type: "TRANSFER_OUT",
          status: "SUCCESS",
          amount,
          balanceAfter: saldoPengirim.balance,
          note: `Transfer ke ${penerima.user.name} (${samarkan(input.toAccountNumber)})${catatan ? ` - ${catatan}` : ""}`,
        },
        {
          walletId: penerima.id,
          type: "TRANSFER_IN",
          status: "SUCCESS",
          amount,
          balanceAfter: saldoPenerima.balance,
          note: `Transfer dari ${samarkan(pengirim.accountNumber)}${catatan ? ` - ${catatan}` : ""}`,
        },
      ],
    });

    return {
      transferred: true,
      amount: amount.toString(),
      balance: saldoPengirim.balance,
      to: { accountNumber: input.toAccountNumber, name: penerima.user.name },
    };
  });
}

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

// ── Pencairan berkala ────────────────────────────────────────────────────────

/**
 * Menyapu pesanan yang sudah SELESAI tapi hasil penjualannya belum masuk ke
 * dompet penjual, lalu membayarnya.
 *
 * Pengkreditan sebenarnya sudah terjadi langsung saat pesanan selesai. Sapuan
 * ini jaring pengaman: kalau proses mati di tengah jalan setelah status
 * berubah tapi sebelum dompet terisi, uang penjual tidak menggantung sampai
 * ada yang menyadarinya.
 *
 * Aman diulang berapa kali pun — `settledAt` diklaim lewat updateMany
 * bersyarat, jadi dua sapuan yang berjalan bersamaan tidak bisa sama-sama
 * membayar pesanan yang sama.
 */
export async function settleCompletedOrders(limit = 200) {
  const kandidat = await prisma.order.findMany({
    where: { status: "COMPLETED", settledAt: null },
    select: {
      id: true,
      orderNumber: true,
      total: true,
      commissionAmount: true,
      seller: { select: { userId: true } },
    },
    take: limit,
  });

  let dibayar = 0;
  for (const order of kandidat) {
    try {
      await prisma.$transaction(async (tx) => {
        const diklaim = await tx.order.updateMany({
          where: { id: order.id, settledAt: null },
          data: { settledAt: new Date() },
        });
        if (diklaim.count === 0) return; // sapuan lain sudah membayarnya

        await creditSellerEarning(
          tx,
          order.seller.userId,
          order.id,
          order.total.minus(order.commissionAmount),
          `Hasil penjualan order ${order.orderNumber} (dipotong komisi platform)`
        );
        dibayar += 1;
      });
    } catch (error) {
      logger.error({ err: error, orderId: order.id }, "gagal cairkan hasil penjualan");
    }
  }

  return { candidates: kandidat.length, settled: dibayar };
}
