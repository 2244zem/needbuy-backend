-- NeedPay: dompet saldo + buku besarnya.
CREATE TYPE "WalletTxType" AS ENUM ('TOPUP', 'PAYMENT', 'REFUND');
CREATE TYPE "WalletTxStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'EXPIRED');

CREATE TABLE "wallets" (
  "id"         TEXT NOT NULL,
  "user_id"    TEXT NOT NULL,
  "balance"    DECIMAL(14,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallets_user_id_key" ON "wallets"("user_id");

ALTER TABLE "wallets"
  ADD CONSTRAINT "wallets_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "wallet_transactions" (
  "id"                TEXT NOT NULL,
  "wallet_id"         TEXT NOT NULL,
  "type"              "WalletTxType" NOT NULL,
  "status"            "WalletTxStatus" NOT NULL DEFAULT 'PENDING',
  "amount"            DECIMAL(14,2) NOT NULL,
  "balance_after"     DECIMAL(14,2),
  "order_id"          TEXT,
  "note"              TEXT,
  "midtrans_order_id" TEXT,
  "snap_token"        TEXT,
  "snap_redirect_url" TEXT,
  "raw_response"      JSONB,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"        TIMESTAMP(3) NOT NULL,
  CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "wallet_transactions_midtrans_order_id_key"
  ON "wallet_transactions"("midtrans_order_id");
CREATE INDEX "wallet_transactions_wallet_id_created_at_idx"
  ON "wallet_transactions"("wallet_id", "created_at");

ALTER TABLE "wallet_transactions"
  ADD CONSTRAINT "wallet_transactions_wallet_id_fkey" FOREIGN KEY ("wallet_id")
  REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NeedPay sebagai metode bayar di kolom payments.method (kolom teks bebas,
-- jadi tidak ada perubahan tipe yang diperlukan).
