-- Berkas unggahan pindah dari disk ke database supaya ikut ter-backup dan
-- tidak hilang saat server dipindah atau di-deploy ke filesystem sementara.

-- CreateTable
CREATE TABLE "uploads" (
    "id" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
-- SET NULL, bukan CASCADE: logo toko yang masih dipakai tidak boleh hilang
-- hanya karena akun pengunggahnya dihapus.
ALTER TABLE "uploads" ADD CONSTRAINT "uploads_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
