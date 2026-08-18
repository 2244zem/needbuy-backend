-- Penarikan saldo penjual + laporan pengguna.
--
-- Penarikan sengaja TIDAK memakai tabel sendiri: ia adalah mutasi dompet
-- seperti top-up dan pembayaran, jadi ikut buku besar `wallet_transactions`
-- supaya saldo tetap punya satu sumber kebenaran.

-- ==================== Withdrawal ====================

ALTER TYPE "WalletTxType" ADD VALUE 'WITHDRAWAL';

ALTER TABLE "wallet_transactions"
  ADD COLUMN "bank_name" TEXT,
  ADD COLUMN "bank_account" TEXT,
  ADD COLUMN "bank_account_name" TEXT,
  ADD COLUMN "handled_by_id" TEXT,
  ADD COLUMN "handled_at" TIMESTAMP(3);

-- Antrean penarikan dibaca admin dengan filter status; tanpa index ini tiap
-- buka halaman Withdrawals berarti sequential scan seluruh mutasi dompet.
CREATE INDEX "wallet_transactions_type_status_created_at_idx"
  ON "wallet_transactions" ("type", "status", "created_at");

-- ==================== Reports ====================

CREATE TYPE "ReportTargetType" AS ENUM ('PRODUCT', 'SELLER', 'REVIEW');
CREATE TYPE "ReportPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

CREATE TABLE "reports" (
  "id" TEXT NOT NULL,
  "reporter_id" TEXT NOT NULL,
  "target_type" "ReportTargetType" NOT NULL,
  "target_id" TEXT NOT NULL,
  "target_label" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT,
  "priority" "ReportPriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
  "resolution" TEXT,
  "handled_by_id" TEXT,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- Satu pelapor, satu laporan per sasaran. Penjaga di level database supaya
-- spam laporan tidak bergantung pada pengecekan di service saja.
CREATE UNIQUE INDEX "reports_reporter_id_target_type_target_id_key"
  ON "reports" ("reporter_id", "target_type", "target_id");

CREATE INDEX "reports_status_created_at_idx" ON "reports" ("status", "created_at");
CREATE INDEX "reports_target_type_target_id_idx" ON "reports" ("target_type", "target_id");

ALTER TABLE "reports"
  ADD CONSTRAINT "reports_reporter_id_fkey"
  FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
