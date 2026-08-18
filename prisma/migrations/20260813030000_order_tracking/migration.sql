-- Jejak perjalanan paket, append-only.
CREATE TYPE "TrackingStage" AS ENUM (
  'PACKING',
  'PICKED_UP',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'RETURNED',
  'CANCELLED'
);

CREATE TABLE "order_tracking" (
  "id"            TEXT NOT NULL,
  "order_id"      TEXT NOT NULL,
  "stage"         "TrackingStage" NOT NULL,
  "description"   TEXT NOT NULL,
  "location"      TEXT,
  "created_by_id" TEXT,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "order_tracking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_tracking_order_id_created_at_idx"
  ON "order_tracking"("order_id", "created_at");

ALTER TABLE "order_tracking"
  ADD CONSTRAINT "order_tracking_order_id_fkey" FOREIGN KEY ("order_id")
  REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
