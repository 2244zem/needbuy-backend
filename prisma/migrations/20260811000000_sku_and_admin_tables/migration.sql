-- `sku` sudah ditambahkan migration 20260810151551_mig. Duplikat ini bikin
-- replay ke shadow database gagal (P3006), jadi dibuat idempoten.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sku" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku");
CREATE TABLE "admin_configs" (
    "id" TEXT NOT NULL,
    "config_key" TEXT NOT NULL,
    "config_value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_configs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_configs_config_key_key" ON "admin_configs"("config_key");

CREATE TABLE "admin_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admin_profiles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "admin_profiles_user_id_key" ON "admin_profiles"("user_id");
CREATE UNIQUE INDEX "admin_profiles_email_key" ON "admin_profiles"("email");
ALTER TABLE "admin_profiles" ADD CONSTRAINT "admin_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
