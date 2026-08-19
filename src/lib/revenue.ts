import type { Prisma } from "@prisma/client";

/**
 * Pesanan yang uangnya benar-benar berpindah.
 *
 * Sebelumnya semua laporan menyaring `payment.status === "PAID"` saja. Itu
 * melewatkan SELURUH pesanan COD: pembayarannya tunai di tangan kurir, jadi
 * baris payment-nya tidak pernah beranjak dari PENDING. Karena COD adalah
 * cara bayar yang paling lazim di sini, kolom "Order" dan "Total Belanja" di
 * dashboard admin nyaris selalu terbaca kosong.
 *
 * COD dihitung setelah paket sampai — saat itulah uangnya benar-benar
 * diserahkan. Menghitungnya lebih awal berarti mengakui pemasukan yang belum
 * tentu terjadi. Pesanan yang dibatalkan tidak pernah dihitung, termasuk yang
 * sempat lunas lalu dikembalikan.
 */
export const PAID_ORDER_WHERE: Prisma.OrderWhereInput = {
  status: { not: "CANCELLED" },
  OR: [
    { payment: { status: "PAID" } },
    { payment: { method: "COD" }, status: { in: ["DELIVERED", "COMPLETED"] } },
  ],
};
