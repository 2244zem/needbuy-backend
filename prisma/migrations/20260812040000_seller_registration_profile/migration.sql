-- Pendaftaran penjual dipindah dari form register/login ke halaman profil, dan
-- sekarang mewajibkan data toko. Dua kolom di bawah nullable supaya baris
-- sellers yang sudah ada tetap valid; kewajiban isinya ditegakkan validasi
-- pendaftaran (createSellerSchema), bukan constraint DB.

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN "address" TEXT;
ALTER TABLE "sellers" ADD COLUMN "phone" TEXT;
