-- Chat: kirim foto, dan kartu pesanan otomatis saat checkout.
ALTER TABLE "messages"
  ALTER COLUMN "body" DROP NOT NULL,
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "order_id" TEXT;
