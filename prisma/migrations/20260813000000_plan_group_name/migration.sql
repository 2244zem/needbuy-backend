-- Grup belanja: plan punya nama, dan budget jadi opsional (0 = tanpa anggaran).
ALTER TABLE "shopping_plans" ADD COLUMN "name" VARCHAR(60);
ALTER TABLE "shopping_plans" ALTER COLUMN "budget" SET DEFAULT 0;
