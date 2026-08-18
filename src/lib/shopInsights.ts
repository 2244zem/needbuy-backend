export type InsightSeverity = "critical" | "warning" | "info" | "positive";

export type ShopInsight = {
  code: string;
  severity: InsightSeverity;
  message: string;
};

export type ShopInsightInput = {
  revenue: number;
  orders: number;
  views: number;
  conversionRate: number;

  revenuePrev: number;
  ordersPrev: number;
  conversionRatePrev: number;

  topProducts: { name: string; quantity: number; stock: number }[];

  outOfStockCount: number;

  unviewedCount: number;

  activeProductCount: number;
};

const LOW_CONVERSION_PERCENT = 1;

const RESTOCK_THRESHOLD = 5;

const rupiah = (value: number) => `Rp${Math.round(value).toLocaleString("id-ID")}`;
const percent = (value: number) => `${value.toFixed(1)}%`;

export function buildShopInsights(input: ShopInsightInput, limit = 4): ShopInsight[] {
  const insights: ShopInsight[] = [];

  if (input.activeProductCount === 0) {
    return [
      {
        code: "NO_ACTIVE_PRODUCTS",
        severity: "critical",
        message:
          "Belum ada produk aktif di toko. Tambahkan produk dan tayangkan supaya bisa muncul di pencarian pembeli.",
      },
    ];
  }

  if (input.views === 0) {
    insights.push({
      code: "NO_TRAFFIC",
      severity: "warning",
      message:
        "Belum ada kunjungan ke produk kamu pada periode ini. Lengkapi judul, foto, dan kategori supaya produk lebih mudah ditemukan.",
    });
  }

  const atRisk = input.topProducts.filter(
    (product) => product.quantity > 0 && product.stock <= RESTOCK_THRESHOLD
  );
  for (const product of atRisk.slice(0, 2)) {
    insights.push({
      code: "RESTOCK_BESTSELLER",
      severity: product.stock === 0 ? "critical" : "warning",
      message:
        product.stock === 0
          ? `"${product.name}" terjual ${product.quantity} unit periode ini tapi stoknya udah habis. Tiap pengunjung setelah ini itu penjualan yang hilang.`
          : `"${product.name}" terjual ${product.quantity} unit dan sisa stoknya tinggal ${product.stock}. Tambah stok sebelum kehabisan.`,
    });
  }

  if (input.outOfStockCount > 0) {
    insights.push({
      code: "OUT_OF_STOCK",
      severity: "warning",
      message: `${input.outOfStockCount} produk masih tayang tapi stoknya habis. Isi ulang stoknya atau jadiin draf aja biar pembeli nggak kecewa.`,
    });
  }

  if (input.conversionRatePrev > 0 && input.conversionRate > 0) {
    const delta = input.conversionRate - input.conversionRatePrev;
    if (Math.abs(delta) >= 0.1) {
      insights.push({
        code: delta > 0 ? "CONVERSION_UP" : "CONVERSION_DOWN",
        severity: delta > 0 ? "positive" : "warning",
        message: `Konversi ${delta > 0 ? "naik" : "turun"} ${percent(Math.abs(delta))} dibanding periode sebelumnya (${percent(
          input.conversionRatePrev
        )} → ${percent(input.conversionRate)}).`,
      });
    }
  }

  if (input.views > 0 && input.conversionRate < LOW_CONVERSION_PERCENT) {
    insights.push({
      code: "LOW_CONVERSION",
      severity: "warning",
      message: `Dari ${input.views} kunjungan hanya ${input.orders} yang jadi order (${percent(
        input.conversionRate
      )}). Perjelas deskripsi dan foto produk, lalu cek apakah harganya masih masuk akal.`,
    });
  }

  if (input.unviewedCount > 0) {
    insights.push({
      code: "UNVIEWED_PRODUCTS",
      severity: "info",
      message: `${input.unviewedCount} dari ${input.activeProductCount} produk aktif belum dilihat siapa pun periode ini. Coba perbaiki judul dan kategorinya.`,
    });
  }

  if (input.revenuePrev > 0) {
    const growth = ((input.revenue - input.revenuePrev) / input.revenuePrev) * 100;
    if (Math.abs(growth) >= 5) {
      insights.push({
        code: growth > 0 ? "REVENUE_UP" : "REVENUE_DOWN",
        severity: growth > 0 ? "positive" : "warning",
        message: `Pendapatan ${growth > 0 ? "naik" : "turun"} ${percent(Math.abs(growth))} dibanding periode sebelumnya (${rupiah(
          input.revenuePrev
        )} → ${rupiah(input.revenue)}).`,
      });
    }
  }

  const best = input.topProducts[0];
  if (best && best.quantity > 0 && best.stock > RESTOCK_THRESHOLD) {
    insights.push({
      code: "PROMOTE_BESTSELLER",
      severity: "info",
      message: `"${best.name}" paling laku periode ini (${best.quantity} unit) dan stoknya masih ${best.stock}. Produk ini kandidat terbaik untuk dipromosikan.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      code: "STEADY",
      severity: "info",
      message:
        "Belum ada perubahan menonjol pada periode ini. Data akan lebih berguna setelah ada lebih banyak kunjungan dan order.",
    });
  }

  const rank: Record<InsightSeverity, number> = { critical: 0, warning: 1, positive: 2, info: 3 };
  return insights.sort((a, b) => rank[a.severity] - rank[b.severity]).slice(0, limit);
}
