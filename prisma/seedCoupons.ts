import { PrismaClient, type CouponCategory, type CouponType } from "@prisma/client";

const prisma = new PrismaClient();

type CouponSeed = {
  code: string;
  title: string;
  description: string;
  type: CouponType;
  category: CouponCategory;
  value: number;
  minSpend: number;
  maxDiscount?: number;
  isReward: boolean;
};

const COUPONS: CouponSeed[] = [
  {
    code: "GRATISONGKIR300",
    title: "Gratis ongkir",
    description: "Ongkir ditanggung NeedBuy untuk belanja mulai Rp300.000.",
    type: "FREE_SHIPPING",
    category: "SHIPPING",
    value: 0,
    minSpend: 300_000,
    isReward: true,
  },
  {
    code: "CASHBACK30",
    title: "Cashback 30%",
    description: "Potongan 30% untuk belanja mulai Rp400.000, maksimal Rp150.000.",
    type: "PERCENT",
    category: "CASHBACK",
    value: 30,
    minSpend: 400_000,
    maxDiscount: 150_000,
    isReward: true,
  },
  {
    code: "HEMAT25RB",
    title: "Potongan Rp25.000",
    description: "Langsung potong Rp25.000 untuk belanja mulai Rp150.000.",
    type: "FIXED",
    category: "DISCOUNT",
    value: 25_000,
    minSpend: 150_000,
    isReward: true,
  },
  {
    code: "GRATISONGKIR150",
    title: "Gratis ongkir hemat",
    description: "Ongkir gratis untuk belanja mulai Rp150.000.",
    type: "FREE_SHIPPING",
    category: "SHIPPING",
    value: 0,
    minSpend: 150_000,
    isReward: true,
  },
  {
    code: "CASHBACK10",
    title: "Cashback 10%",
    description: "Potongan 10% untuk belanja mulai Rp100.000, maksimal Rp30.000.",
    type: "PERCENT",
    category: "CASHBACK",
    value: 10,
    minSpend: 100_000,
    maxDiscount: 30_000,
    isReward: true,
  },
];

async function main() {
  for (const coupon of COUPONS) {
    const data = {
      title: coupon.title,
      description: coupon.description,
      type: coupon.type,
      category: coupon.category,
      value: coupon.value,
      minSpend: coupon.minSpend,
      maxDiscount: coupon.maxDiscount ?? null,
      isReward: coupon.isReward,
      isActive: true,
    };
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: data,
      create: { code: coupon.code, ...data },
    });
  }

  const rewards = COUPONS.filter((c) => c.isReward).length;
  console.log(`Kupon tersimpan: ${COUPONS.length} (${rewards} masuk undian hadiah checkout)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());