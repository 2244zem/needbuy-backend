/**
 * Penjaga anti-beli-toko-sendiri.
 *
 * Alasannya bukan sekadar aturan marketplace: penjual yang bisa membeli
 * barangnya sendiri bisa menyelesaikan ordernya sendiri lalu menulis ulasan
 * bintang lima atas namanya sendiri. Rating produk dan rating toko dihitung
 * dari ulasan itu, jadi satu lubang ini merusak seluruh angka kepercayaan.
 *
 * Bagian murni dipisah dari query supaya keputusannya bisa diuji tanpa DB.
 */

/** true kalau salah satu toko di `sellerIds` adalah toko milik user itu sendiri. */
export function hasOwnStore(
  ownSellerId: string | null | undefined,
  sellerIds: Iterable<string>
): boolean {
  if (!ownSellerId) return false;
  for (const id of sellerIds) {
    if (id === ownSellerId) return true;
  }
  return false;
}

export const SELF_PURCHASE_CODE = "SELF_PURCHASE_FORBIDDEN";
export const SELF_PURCHASE_MESSAGE =
  "Kamu nggak bisa beli barang dari tokomu sendiri.";

export const SELF_REVIEW_MESSAGE =
  "Kamu nggak bisa nulis ulasan buat tokomu sendiri.";
