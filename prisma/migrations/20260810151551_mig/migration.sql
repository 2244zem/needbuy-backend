CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE');
ALTER TABLE "products" ADD COLUMN     "sku" TEXT;
ALTER TABLE "users" ADD COLUMN     "auth_provider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "auth_provider_id" TEXT,
ADD COLUMN     "username" TEXT NOT NULL,
ALTER COLUMN "password_hash" DROP NOT NULL;
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
