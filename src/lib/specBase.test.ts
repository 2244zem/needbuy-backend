import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CATEGORY_ALIASES,
  CATEGORY_SPECS,
  REQUIRED_SPECS_PER_CATEGORY,
  canonicalCategory,
  isSpecAbsurd,
  isSpecSuspicious,
  normalizeSpecKey,
  parseSpecValue,
  priceSuspicion,
  requiredSpecsFor,
  specAppliesToCategory,
} from "./specBase";

test("setiap kategori kanonik punya daftar spesifikasi yang tidak kosong", () => {
  for (const category of Object.keys(CATEGORY_ALIASES)) {
    const specs = CATEGORY_SPECS[category];
    assert.ok(specs, `kategori ${category} tidak punya entri CATEGORY_SPECS`);
    assert.ok(specs.length > 0, `kategori ${category} punya daftar spesifikasi kosong`);
  }
});

test("setiap spesifikasi wajib juga terdaftar sebagai relevan", () => {
  for (const [category, required] of Object.entries(REQUIRED_SPECS_PER_CATEGORY)) {
    for (const spec of required) {
      assert.ok(
        CATEGORY_SPECS[category]?.includes(spec),
        `${spec} wajib untuk ${category} tapi tidak ada di CATEGORY_SPECS`
      );
    }
  }
});

test("nama kategori bebas dipetakan ke kategori kanonik", () => {
  assert.equal(canonicalCategory("Kulkas 2 Pintu"), "kulkas");
  assert.equal(canonicalCategory("LAPTOP"), "laptop");
  assert.equal(canonicalCategory("laptop-gaming"), "laptop");
  assert.equal(canonicalCategory("Mesin Cuci"), "mesin-cuci");
});

test("kategori tak dikenal dan kosong menghasilkan null", () => {
  assert.equal(canonicalCategory("barang antik"), null);
  assert.equal(canonicalCategory(""), null);
  assert.equal(canonicalCategory(null), null);
});

test("relevansi spesifikasi mengikuti kategori", () => {
  assert.equal(specAppliesToCategory("ram", "laptop"), true);
  assert.equal(specAppliesToCategory("ram", "kulkas"), false);
  assert.equal(specAppliesToCategory("kapasitas", "kulkas"), true);
});

test("kategori tak dikenal membolehkan semua spesifikasi", () => {
  assert.equal(specAppliesToCategory("ram", "barang antik"), true);
  assert.equal(specAppliesToCategory("apa saja", null), true);
});

test("spesifikasi wajib diambil per kategori", () => {
  assert.deepEqual(requiredSpecsFor("laptop"), ["ram", "storage", "prosesor"]);
  assert.deepEqual(requiredSpecsFor("kulkas"), ["kapasitas"]);
  assert.deepEqual(requiredSpecsFor("barang antik"), []);
});

test("nama atribut ragam bebas dinormalisasi", () => {
  assert.equal(normalizeSpecKey("RAM"), "ram");
  assert.equal(normalizeSpecKey("penyimpanan"), "storage");
  assert.equal(normalizeSpecKey("Processor"), "prosesor");
  assert.equal(normalizeSpecKey("display"), "layar");
  assert.equal(normalizeSpecKey("capacity"), "kapasitas");
  assert.equal(normalizeSpecKey("PK"), "kapasitas");
});

test("atribut yang tidak dikenal menghasilkan null, bukan tebakan", () => {
  assert.equal(normalizeSpecKey("bahan casing"), null);
  assert.equal(normalizeSpecKey(""), null);
});

test("satuan diseragamkan ke satuan dasar band", () => {
  assert.equal(parseSpecValue("16 GB")?.number, 16);
  assert.equal(parseSpecValue("2TB")?.number, 2048);
  assert.equal(parseSpecValue("2 tahun")?.number, 24);
  assert.equal(parseSpecValue("500 gram")?.number, 0.5);
});

test("nilai tanpa angka tidak bisa diurai", () => {
  assert.equal(parseSpecValue("tipis dan ringan"), null);
  assert.equal(parseSpecValue(""), null);
});

test("nilai mustahil ditandai absurd", () => {
  assert.equal(isSpecAbsurd("ram", "500 GB").flagged, true);
  assert.equal(isSpecAbsurd("baterai", "1000000 mAh").flagged, true);
  assert.equal(isSpecAbsurd("kamera", "5000 MP").flagged, true);
  assert.equal(isSpecAbsurd("ram", "16 GB").flagged, false);
  assert.equal(isSpecAbsurd("storage", "512 GB").flagged, false);
});

test("nilai di atas rata-rata ditandai mencurigakan, bukan absurd", () => {
  assert.equal(isSpecSuspicious("ram", "200 GB").flagged, true);
  assert.equal(isSpecAbsurd("ram", "200 GB").flagged, false);
  assert.equal(isSpecSuspicious("ram", "16 GB").flagged, false);
});

test("absurd dan suspicious tidak pernah menyala bersamaan", () => {
  for (const value of ["8 GB", "200 GB", "500 GB", "99999 GB"]) {
    const both = isSpecAbsurd("ram", value).flagged && isSpecSuspicious("ram", value).flagged;
    assert.equal(both, false, `"${value}" ditandai dua-duanya`);
  }
});

test("key tanpa rentang tidak pernah ditandai", () => {
  assert.equal(isSpecAbsurd("prosesor", "i9-13900K").flagged, false);
  assert.equal(isSpecSuspicious("warna", "merah").flagged, false);
});

test("harga jauh di bawah kisaran kategori ditandai", () => {
  assert.equal(priceSuspicion("laptop", 50_000).flagged, true);
  assert.equal(priceSuspicion("laptop", 7_000_000).flagged, false);
});

test("harga nol atau negatif selalu ditandai apa pun kategorinya", () => {
  assert.equal(priceSuspicion("kulkas", 0).flagged, true);
  assert.equal(priceSuspicion("barang antik", -1).flagged, true);
});

test("harga jauh di atas kisaran kategori ditandai", () => {
  assert.equal(priceSuspicion("mouse", 500_000_000).flagged, true);
});

test("kategori tak dikenal tidak pernah ditandai harganya", () => {
  assert.equal(priceSuspicion("barang antik", 1).flagged, false);
  assert.equal(priceSuspicion(null, 999_999_999).flagged, false);
});

test("harga kosong bukan pelanggaran", () => {
  assert.equal(priceSuspicion("laptop", null).flagged, false);
  assert.equal(priceSuspicion("laptop", undefined).flagged, false);
});
