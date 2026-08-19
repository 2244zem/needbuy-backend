-- Nomor rekening NeedPay, PIN, dan penanda pencairan hasil penjualan.

-- 1. Nomor rekening. Dibuat lewat sequence supaya unik tanpa perlu diundi
--    ulang di aplikasi, dan tetap terbaca manusia untuk disebut saat transfer.
CREATE SEQUENCE IF NOT EXISTS needpay_account_seq START 1000001;

ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_number" VARCHAR(20);

-- Backfill dompet yang sudah ada, berurutan dan bebas tabrakan.
UPDATE "wallets"
SET "account_number" = 'NP' || lpad(nextval('needpay_account_seq')::text, 10, '0')
WHERE "account_number" IS NULL;

ALTER TABLE "wallets"
  ALTER COLUMN "account_number" SET DEFAULT 'NP' || lpad(nextval('needpay_account_seq')::text, 10, '0');

ALTER TABLE "wallets" ALTER COLUMN "account_number" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "wallets_account_number_key" ON "wallets"("account_number");

-- 2. PIN transfer. Disimpan sebagai hash, sama seperti password.
ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "pin_hash" TEXT;

-- 3. Penanda hasil penjualan sudah masuk ke dompet penjual. Dipakai supaya
--    penyapuan berkala tidak pernah membayar pesanan yang sama dua kali.
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP(3);

-- Pesanan yang sudah selesai SEBELUM fitur ini ada sengaja ditandai lunas:
-- uangnya tidak pernah tercatat sebagai utang platform, jadi menyapunya
-- sekarang sama saja dengan membayar dua kali.
UPDATE "orders" SET "settled_at" = "completed_at"
WHERE "status" = 'COMPLETED' AND "settled_at" IS NULL;

CREATE INDEX IF NOT EXISTS "orders_settlement_idx" ON "orders"("status", "settled_at");

-- 4. Jenis mutasi untuk transfer antar-pengguna.
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "WalletTxType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';
