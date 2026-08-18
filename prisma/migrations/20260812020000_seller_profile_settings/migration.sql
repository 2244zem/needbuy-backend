-- AlterTable
ALTER TABLE "sellers" ADD COLUMN "description" TEXT;
ALTER TABLE "sellers" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "sellers" ADD COLUMN "business_email" TEXT;

-- Libur yang diatur penjual sendiri. Dipisah dari kolom "status" karena
-- SUSPENDED adalah tindakan moderasi admin; kalau digabung, penjual bisa
-- mencabut suspensinya sendiri lewat halaman setelan.
ALTER TABLE "sellers" ADD COLUMN "vacation_mode" BOOLEAN NOT NULL DEFAULT false;
