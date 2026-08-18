-- Foto profil user. Nullable: akun lama tidak punya, dan avatar memang opsional.
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;
