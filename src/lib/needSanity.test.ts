import assert from "node:assert/strict";
import { test } from "node:test";
import { checkNeedSanity } from "./needSanity.js";

function check(overrides: Record<string, unknown>) {
  return checkNeedSanity({
    rawInput: "butuh laptop budget 10 juta ram 16gb",
    requirements: [{ key: "ram", value: "16GB" }],
    categorySlug: "laptop",
    budget: 10_000_000,
    ...overrides,
  });
}

test("input normal tidak terdeteksi absurd", () => {
  const report = check({});
  assert.equal(report.detected, false);
  assert.deepEqual(report.issues, []);
});

test("spesifikasi mustahil terdeteksi (critical)", () => {
  const report = check({ requirements: [{ key: "ram", value: "500 GB" }] });
  assert.equal(report.detected, true);
  assert.ok(report.issues.some((i) => i.code === "ABSURD_SPEC" && i.severity === "critical"));
});

test("spesifikasi tidak relevan untuk kategori terdeteksi", () => {
  const report = check({
    requirements: [{ key: "ram", value: "16GB" }],
    categorySlug: "kulkas",
  });
  assert.ok(report.issues.some((i) => i.code === "IRRELEVANT_SPEC"));
});

test("nilai mencurigakan (di atas rata-rata) bukan critical", () => {
  const report = check({ requirements: [{ key: "ram", value: "200 GB" }] });
  assert.equal(report.detected, false);
  assert.ok(report.issues.some((i) => i.code === "SUSPICIOUS_SPEC" && i.severity === "warning"));
});

test("requirement bertentangan terdeteksi", () => {
  const report = check({
    requirements: [
      { key: "ram", value: "8GB" },
      { key: "ram", value: "16GB" },
    ],
  });
  assert.ok(report.issues.some((i) => i.code === "CONTRADICTORY_SPEC"));
});

test("input spam karakater berulang terdeteksi", () => {
  const report = check({ rawInput: "aaaaaaaaaaaaaaaa" });
  assert.equal(report.detected, true);
});

test("input kosong terdeteksi", () => {
  const report = check({ rawInput: "   " });
  assert.equal(report.detected, true);
});

test("input emoji saja terdeteksi", () => {
  const report = check({ rawInput: "\u{1F600}\u{1F601}\u{1F602}" });
  assert.equal(report.detected, true);
});

test("budget terlalu rendah untuk kategori terdeteksi", () => {
  const report = check({ budget: 200_000 });
  assert.ok(report.issues.some((i) => i.code === "BUDGET_TOO_LOW"));
});

test("nilai storage dalam TB dikonversi benar (absurd di atas rentang)", () => {
  const report = check({ requirements: [{ key: "storage", value: "2 TB" }] });
  assert.equal(report.detected, false);
  assert.ok(!report.issues.some((i) => i.code === "ABSURD_SPEC"));
});

const codesFor = (
  requirements: { key: string; value: string }[],
  categorySlug: string | null = "laptop",
  budget: number | null = 10_000_000
) =>
  checkNeedSanity({
    rawInput: "butuh barang yang bagus untuk dipakai sehari-hari",
    requirements,
    categorySlug,
    budget,
  }).issues.map((i) => i.code);

test("satuan tahun dikonversi ke bulan sebelum dibandingkan", () => {
  assert.ok(!codesFor([{ key: "garansi", value: "2 tahun" }]).includes("ABSURD_SPEC"));
  assert.ok(codesFor([{ key: "garansi", value: "6 tahun" }]).includes("SUSPICIOUS_SPEC"));
  assert.ok(codesFor([{ key: "garansi", value: "30 tahun" }]).includes("ABSURD_SPEC"));
});

test("satuan TB dikonversi ke GB sebelum dibandingkan", () => {
  assert.ok(!codesFor([{ key: "storage", value: "2 TB" }]).includes("ABSURD_SPEC"));
  assert.ok(codesFor([{ key: "storage", value: "999 TB" }]).includes("ABSURD_SPEC"));
});

test("nilai tanpa angka tidak dianggap absurd, hanya diabaikan", () => {
  for (const value of ["tipis dan ringan", "", "yang bagus"]) {
    const codes = codesFor([{ key: "ram", value }]);
    assert.ok(!codes.includes("ABSURD_SPEC"), `"${value}" tidak boleh dituduh absurd`);
  }
});

test("relevansi kategori diperiksa untuk spek tanpa rentang angka", () => {
  assert.ok(codesFor([{ key: "prosesor", value: "i7" }], "kulkas").includes("IRRELEVANT_SPEC"));
});

test("slug kategori majemuk tetap dikenali", () => {
  assert.ok(codesFor([{ key: "ram", value: "16 GB" }], "kulkas-2-pintu").includes("IRRELEVANT_SPEC"));
  assert.ok(codesFor([{ key: "ram", value: "16 GB" }], "laptop-gaming").length === 0);
});

test("spesifikasi yang memang relevan untuk kategorinya tidak dituduh", () => {
  assert.deepEqual(codesFor([{ key: "kapasitas", value: "200 liter" }], "kulkas", 3_000_000), []);
  assert.deepEqual(codesFor([{ key: "daya", value: "350 watt" }], "ac", 3_000_000), []);
  assert.deepEqual(codesFor([{ key: "layar", value: "27 inch" }], "monitor", 3_000_000), []);
});

test("kategori tak dikenal membolehkan semua spesifikasi", () => {
  assert.deepEqual(codesFor([{ key: "ram", value: "16 GB" }], "barang-antik"), []);
  assert.deepEqual(codesFor([{ key: "ram", value: "16 GB" }], null), []);
});

test("nilai absurd tetap terdeteksi walau kategorinya cocok", () => {
  const codes = codesFor([{ key: "ram", value: "500 GB" }], "laptop");
  assert.ok(codes.includes("ABSURD_SPEC"));
  assert.ok(!codes.includes("IRRELEVANT_SPEC"), "ram memang relevan untuk laptop");
});

test("kamera 5000 MP dan baterai 1 juta mAh terdeteksi absurd", () => {
  assert.ok(codesFor([{ key: "kamera", value: "5000 MP" }], "smartphone").includes("ABSURD_SPEC"));
  assert.ok(codesFor([{ key: "baterai", value: "1000000 mAh" }], "smartphone").includes("ABSURD_SPEC"));
});

test("kombinasi absurd lengkap: kulkas yang punya RAM dengan budget kecil", () => {
  const report = checkNeedSanity({
    rawInput: "saya butuh kulkas dengan ram 500gb untuk dekorasi kamar",
    requirements: [{ key: "ram", value: "500 GB" }],
    categorySlug: "kulkas",
    budget: 200_000,
  });
  assert.equal(report.detected, true);
  const codes = report.issues.map((i) => i.code);
  assert.ok(codes.includes("ABSURD_SPEC"));
  assert.ok(codes.includes("IRRELEVANT_SPEC"));
  assert.ok(codes.includes("BUDGET_TOO_LOW"));
});

test("input normal lengkap tetap bersih sepenuhnya", () => {
  const report = checkNeedSanity({
    rawInput: "saya mau beli laptop untuk kuliah, ram minimal 16gb, budget 10 juta",
    requirements: [
      { key: "ram", value: "16 GB" },
      { key: "storage", value: "512 GB" },
    ],
    categorySlug: "laptop",
    budget: 10_000_000,
  });
  assert.equal(report.detected, false);
  assert.deepEqual(report.issues, []);
});
