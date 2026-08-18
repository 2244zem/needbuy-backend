-- Kolom baru untuk panel admin kategori.
--
-- `description`: keterangan singkat, nullable karena kategori yang sudah ada
-- tidak punya dan tidak boleh dipaksa diisi ulang.
--
-- `is_active`: kategori nonaktif hilang dari katalog publik tapi tetap muncul
-- di panel admin. DEFAULT TRUE supaya seluruh baris lama tetap tampil persis
-- seperti sebelum migration ini jalan.
ALTER TABLE "categories" ADD COLUMN "description" TEXT;
ALTER TABLE "categories" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;
