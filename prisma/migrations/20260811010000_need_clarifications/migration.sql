-- CreateTable
CREATE TABLE "need_clarifications" (
    "id" TEXT NOT NULL,
    "need_id" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "field" VARCHAR(32) NOT NULL,
    "question" TEXT NOT NULL,
    "context" TEXT,
    "answer" TEXT,
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "need_clarifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "need_clarifications_need_id_answered_at_idx" ON "need_clarifications"("need_id", "answered_at");

-- CreateIndex
CREATE UNIQUE INDEX "need_clarifications_need_id_ordinal_key" ON "need_clarifications"("need_id", "ordinal");

-- AddForeignKey
ALTER TABLE "need_clarifications" ADD CONSTRAINT "need_clarifications_need_id_fkey" FOREIGN KEY ("need_id") REFERENCES "needs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

