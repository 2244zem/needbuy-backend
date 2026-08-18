-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "commission_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "commission_percent" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- Backfill order lama dengan tarif yang berlaku sekarang (AdminConfig
-- PLATFORM_COMMISSION_PERCENT, default 30). Tanpa ini, seluruh riwayat
-- berkomisi 0 dan "Total Pendapatan" mendadak jatuh ke nol setelah deploy.
UPDATE "orders" o
SET "commission_percent" = c.pct,
    "commission_amount"  = ROUND(o."total" * c.pct / 100, 2)
FROM (
  SELECT COALESCE(
    (SELECT NULLIF("config_value", '')::numeric
     FROM "admin_configs"
     WHERE "config_key" = 'PLATFORM_COMMISSION_PERCENT'),
    30
  ) AS pct
) c;
