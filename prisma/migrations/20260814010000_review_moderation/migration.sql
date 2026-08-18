-- Moderasi ulasan oleh admin.
--
-- Menyembunyikan, bukan menghapus: rating produk dan penjual diturunkan dari
-- ulasan yang tampil, dan menghapus barisnya berarti kehilangan jejak kenapa
-- angka itu berubah. Menyembunyikan juga bisa dibatalkan; menghapus tidak.
--
-- DEFAULT FALSE supaya seluruh ulasan lama tetap tampil persis seperti sebelum
-- migration ini jalan.
ALTER TABLE "reviews" ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;
