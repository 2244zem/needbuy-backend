import assert from "node:assert/strict";
import { test } from "node:test";
import { audit, check, generatePlans, getInsights, getMarketPulse, interpret } from "./ai.service";

test("kebutuhan normal terbaca lengkap dan tidak butuh klarifikasi", () => {
  const hasil = interpret("saya mau beli laptop untuk kuliah, ram minimal 16gb, budget 10 juta");
  assert.equal(hasil.interpretation.category, "laptop");
  assert.equal(hasil.interpretation.budget, 10_000_000);
  assert.equal(hasil.absurdityDetected, false);
  assert.equal(hasil.needsClarification, false);
  assert.ok(hasil.confidenceScore > 0.7);
});

test("requirement bertanda 'minimal' menjadi hard requirement", () => {
  const hasil = interpret("butuh laptop ram minimal 16gb, budget 10 juta");
  const ram = hasil.interpretation.requirements.find((r) => r.key === "ram");
  assert.equal(ram?.isHardRequirement, true);
});

test("kebutuhan absurd terdeteksi dan menurunkan keyakinan", () => {
  const hasil = interpret("saya butuh kulkas dengan ram 500gb untuk dekorasi kamar, budget 200rb");
  assert.equal(hasil.absurdityDetected, true);
  assert.ok(hasil.confidenceScore <= 0.3, "input absurd tidak boleh terdengar yakin");
  assert.ok(hasil.absurdityNotes.length > 0);
  assert.equal(hasil.needsClarification, true);
});

test("input spam menghasilkan pertanyaan klarifikasi, bukan requirement sampah", () => {
  const hasil = interpret("aaaaaaaaaaaaaaaa");
  assert.equal(hasil.absurdityDetected, true);
  assert.equal(hasil.needsClarification, true);
  assert.deepEqual(hasil.interpretation.requirements, []);
});

test("budget yang hilang selalu jadi pertanyaan pertama", () => {
  const hasil = interpret("butuh laptop untuk kuliah");
  assert.equal(hasil.clarificationQuestions[0].field, "budget");
});

test("pertanyaan klarifikasi dibatasi lima", () => {
  const hasil = interpret("🔥🔥🔥");
  assert.ok(hasil.clarificationQuestions.length <= 5);
});

test("interpret tidak pernah melempar untuk input aneh", () => {
  for (const input of ["", "   ", "!@#$%", "a", "🔥"]) {
    assert.doesNotThrow(() => interpret(input));
  }
});

const produk = [
  { id: "murah", name: "Laptop A", price: 5_000_000, rating: 3 },
  { id: "bagus", name: "Laptop B", price: 9_000_000, rating: 4.8 },
  { id: "mahal", name: "Laptop C", price: 20_000_000, rating: 5 },
];

test("dua rencana dibuat: termurah dan terbaik dalam budget", () => {
  const { plans } = generatePlans({ need_id: crypto.randomUUID(), budget: 10_000_000, products: produk });
  assert.equal(plans.length, 2);
  assert.equal(plans[0].strategy, "budget_minimal");
  assert.equal(plans[0].items[0].productId, "murah");
  assert.equal(plans[1].strategy, "optimal");
  assert.equal(plans[1].items[0].productId, "bagus", "yang di luar budget tidak boleh terpilih");
});

test("rencana kedua dilewati kalau produknya sama dengan yang pertama", () => {
  const { plans } = generatePlans({
    need_id: crypto.randomUUID(),
    budget: 10_000_000,
    products: [produk[0]],
  });
  assert.equal(plans.length, 1);
});

test("tanpa produk menghasilkan daftar rencana kosong", () => {
  assert.deepEqual(generatePlans({ need_id: crypto.randomUUID(), budget: 100, products: [] }).plans, []);
  assert.deepEqual(generatePlans({ need_id: crypto.randomUUID(), budget: 100 }).plans, []);
});

test("budget nol tetap menghasilkan rencana termurah", () => {
  const { plans } = generatePlans({ need_id: crypto.randomUUID(), budget: 0, products: produk });
  assert.equal(plans.length, 1);
  assert.equal(plans[0].strategy, "budget_minimal");
});

test("keyakinan insight ikut jumlah rekomendasi, bukan konstanta", () => {
  const kosong = getInsights({ product_count: 0 });
  const banyak = getInsights({ product_count: 10 });
  assert.ok(kosong.insight.confidenceScore < banyak.insight.confidenceScore);
  assert.ok(kosong.insight.confidenceScore <= 0.2, "nol rekomendasi tidak boleh terdengar yakin");
});

test("ringkasan insight menyebut budget kalau ada", () => {
  assert.match(getInsights({ budget: 5_000_000, product_count: 3 }).insight.summary, /5\.000\.000/);
  assert.ok(!getInsights({ product_count: 3 }).insight.summary.includes("budget"));
});

test("market pulse menghitung rata-rata harga dan urgensi stok", () => {
  const { analysis } = getMarketPulse({
    products_data: [
      { price: 1_000_000, stock: 1 },
      { price: 3_000_000, stock: 2 },
    ],
  });
  assert.equal(analysis.averagePrice, 2_000_000);
  assert.equal(analysis.sampleSize, 2);
  assert.equal(analysis.stockUrgency, "high");
});

test("stok aman tidak menaikkan urgensi", () => {
  const { analysis } = getMarketPulse({ products_data: [{ price: 100, stock: 50 }] });
  assert.equal(analysis.stockUrgency, "normal");
});

test("tren harga dilaporkan unknown, bukan mengaku stabil tanpa data", () => {
  assert.equal(getMarketPulse({ products_data: [{ price: 1, stock: 1 }] }).analysis.priceTrend, "unknown");
  assert.equal(getMarketPulse({}).analysis.sampleSize, 0);
});

test("atribut bergaya attr_key maupun key sama-sama terbaca", () => {
  const snake = audit({
    product: {
      name: "Laptop Asus Vivobook",
      description: "Laptop Asus kondisi mulus lengkap dengan charger dan dus resmi.",
      sku: "A1",
      category_name: "laptop",
      price: 8_000_000,
      attributes: [
        { attr_key: "RAM", attr_value: "16 GB" },
        { attr_key: "penyimpanan", attr_value: "512 GB" },
        { attr_key: "prosesor", attr_value: "Intel i5" },
      ],
    },
  });
  assert.deepEqual(snake.audit.issues, []);
  assert.equal(snake.audit.categoryDetected, "laptop");
});

test("check mengenali is_hard_requirement bergaya snake_case", () => {
  const hasil = check({
    product: { name: "Laptop", attributes: [{ attr_key: "ram", attr_value: "8 GB" }] },
    requirements: [{ key: "ram", value: "16 GB", is_hard_requirement: true }],
  });
  assert.equal(hasil.check.hardRequirementsTotal, 1);
  assert.equal(hasil.check.verdict, "MISMATCH");
});

test("check memakai perbandingan sadar satuan yang sama dengan matching engine", () => {
  const hasil = check({
    product: { name: "Laptop", attributes: [{ attr_key: "storage", attr_value: "2 TB" }] },
    requirements: [{ key: "storage", value: "512 GB", is_hard_requirement: true }],
  });
  assert.equal(hasil.check.verdict, "MATCH");
});

test("audit dan check tidak melempar untuk produk kosong", () => {
  assert.doesNotThrow(() => audit({ product: {} }));
  assert.doesNotThrow(() => check({ product: {} }));
});
