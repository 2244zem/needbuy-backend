-- Verifikasi email + reset password.

CREATE TYPE "AuthTokenPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);

-- Akun yang sudah ada dianggap terverifikasi. Tanpa ini, semua pengguna lama
-- mendadak berstatus belum terverifikasi karena fitur yang baru dipasang hari
-- ini — hukuman untuk sesuatu yang belum pernah bisa mereka kerjakan.
UPDATE "users" SET "email_verified_at" = "created_at";

-- Login lewat Google: alamatnya sudah diverifikasi Google sebelum akun dibuat.
-- (Baris di atas sudah mencakupnya; ini penegasan untuk akun yang menyusul.)

CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" "AuthTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_tokens_token_hash_key" ON "auth_tokens"("token_hash");

CREATE INDEX "auth_tokens_user_id_purpose_created_at_idx"
    ON "auth_tokens"("user_id", "purpose", "created_at");

ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
