-- Halaman detail produk: diskon grosir, pilihan varian yang ikut sampai ke
-- order, profil toko yang bisa diikuti, dan ulasan berfoto/bervideo.

-- Diskon grosir. Nullable = tidak ada penawaran grosir. CHECK-nya menjaga
-- rentang yang sama dengan validasi zod, supaya angka aneh tidak bisa masuk
-- lewat jalur lain (seed, SQL manual).
ALTER TABLE "products" ADD COLUMN "bulk_min_qty" INTEGER;
ALTER TABLE "products" ADD COLUMN "bulk_discount_percent" INTEGER;
ALTER TABLE "products" ADD CONSTRAINT "products_bulk_min_qty_check" CHECK ("bulk_min_qty" IS NULL OR "bulk_min_qty" >= 2);
ALTER TABLE "products" ADD CONSTRAINT "products_bulk_discount_percent_check" CHECK ("bulk_discount_percent" IS NULL OR ("bulk_discount_percent" >= 1 AND "bulk_discount_percent" <= 90));

-- Varian yang dipilih pembeli. Teks siap tampil ("Warna: Hitam"), bukan FK:
-- varian di proyek ini berasal dari product_attributes, bukan tabel varian
-- dengan stok sendiri. Di order_items nilainya snapshot, sama seperti
-- product_name.
ALTER TABLE "cart_items" ADD COLUMN "variant" TEXT;
ALTER TABLE "order_items" ADD COLUMN "variant" TEXT;

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable: lampiran ulasan
CREATE TABLE "review_media" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL DEFAULT 'IMAGE',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "review_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "review_media_review_id_idx" ON "review_media"("review_id");

ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_fkey"
    FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: pembeli mengikuti toko
CREATE TABLE "seller_follows" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_follows_pkey" PRIMARY KEY ("id")
);

-- Unique inilah yang membuat "ikuti toko" idempoten tanpa cek-lalu-insert.
CREATE UNIQUE INDEX "seller_follows_user_id_seller_id_key" ON "seller_follows"("user_id", "seller_id");
CREATE INDEX "seller_follows_seller_id_idx" ON "seller_follows"("seller_id");

ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_follows" ADD CONSTRAINT "seller_follows_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
