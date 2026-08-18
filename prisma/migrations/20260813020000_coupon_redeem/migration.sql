-- Kupon bisa dipakai, bukan cuma diklaim.
ALTER TYPE "CouponType" ADD VALUE 'FREE_SHIPPING';

CREATE TYPE "CouponCategory" AS ENUM ('SHIPPING', 'CASHBACK', 'DISCOUNT');

ALTER TABLE "coupons"
  ADD COLUMN "category" "CouponCategory" NOT NULL DEFAULT 'DISCOUNT',
  ADD COLUMN "is_reward" BOOLEAN NOT NULL DEFAULT false;

-- Potongan yang menempel di satu order. Satu checkout bisa jadi beberapa order
-- (satu per toko), jadi potongan kuponnya dibagi dan tiap order menyimpan
-- bagiannya sendiri.
ALTER TABLE "orders"
  ADD COLUMN "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "coupon_id" TEXT;

ALTER TABLE "orders"
  ADD CONSTRAINT "orders_coupon_id_fkey" FOREIGN KEY ("coupon_id")
  REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
