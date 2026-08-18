import assert from "node:assert/strict";
import { test } from "node:test";
import {
  extractNumber,
  isRequirementSatisfied,
  satisfiedRatio,
  weightedSatisfiedRatio,
} from "./attributeMatch";

const attrs = [
  { attrKey: "ram", attrValue: "16GB" },
  { attrKey: "Warna", attrValue: "Hitam" },
];

test("extractNumber menarik angka dari nilai bersatuan", () => {
  assert.equal(extractNumber("16GB"), 16);
  assert.equal(extractNumber("2,5 kg"), 2.5);
  assert.equal(extractNumber("merah"), null);
});

test("requirement numerik puas saat produk >= yang diminta", () => {
  assert.equal(isRequirementSatisfied({ key: "ram", value: "8GB" }, attrs), true);
  assert.equal(isRequirementSatisfied({ key: "ram", value: "16GB" }, attrs), true);
  assert.equal(isRequirementSatisfied({ key: "ram", value: "32GB" }, attrs), false);
});

test("requirement bukan numerik butuh kecocokan persis", () => {
  assert.equal(isRequirementSatisfied({ key: "warna", value: "hitam" }, attrs), true);
  assert.equal(isRequirementSatisfied({ key: "warna", value: "putih" }, attrs), false);
});

test("perbandingan key dan value tidak peduli huruf besar kecil dan spasi", () => {
  assert.equal(isRequirementSatisfied({ key: "  WARNA ", value: " HITAM " }, attrs), true);
});

test("atribut yang tidak ada = tidak terpenuhi", () => {
  assert.equal(isRequirementSatisfied({ key: "storage", value: "512GB" }, attrs), false);
});

test("satisfiedRatio: daftar kosong netral (1), bukan 0", () => {
  assert.equal(satisfiedRatio([], attrs), 1);
});

test("satisfiedRatio menghitung porsi yang terpenuhi", () => {
  const ratio = satisfiedRatio(
    [
      { key: "ram", value: "8GB" },
      { key: "storage", value: "1TB" },
    ],
    attrs
  );
  assert.equal(ratio, 0.5);
});

test("weightedSatisfiedRatio memperhitungkan bobot", () => {
  const ratio = weightedSatisfiedRatio(
    [
      { key: "ram", value: "8GB", weight: 3 },
      { key: "storage", value: "1TB", weight: 1 },
    ],
    attrs
  );
  assert.equal(ratio, 0.75);
});

test("weightedSatisfiedRatio: total bobot nol tidak menghasilkan NaN", () => {
  const ratio = weightedSatisfiedRatio([{ key: "ram", value: "8GB", weight: 0 }], attrs);
  assert.equal(ratio, 1);
});

test("satuan lebih besar memenuhi requirement bersatuan lebih kecil", () => {
  const punya2TB = [{ attrKey: "storage", attrValue: "2 TB" }];
  assert.equal(isRequirementSatisfied({ key: "storage", value: "512 GB" }, punya2TB), true);
});

test("satuan lebih kecil TIDAK memenuhi requirement bersatuan lebih besar", () => {
  const punya512GB = [{ attrKey: "storage", attrValue: "512 GB" }];
  assert.equal(isRequirementSatisfied({ key: "storage", value: "1 TB" }, punya512GB), false);
});

test("tahun dan bulan disetarakan", () => {
  const garansi2Tahun = [{ attrKey: "garansi", attrValue: "2 tahun" }];
  assert.equal(isRequirementSatisfied({ key: "garansi", value: "12 bulan" }, garansi2Tahun), true);
  assert.equal(isRequirementSatisfied({ key: "garansi", value: "36 bulan" }, garansi2Tahun), false);
});

test("satuan yang tidak sebanding jatuh ke perbandingan teks, bukan diadu angkanya", () => {
  const baterai = [{ attrKey: "baterai", attrValue: "5000 mAh" }];
  assert.equal(isRequirementSatisfied({ key: "baterai", value: "10 jam" }, baterai), false);
});

test("key bersinonim dianggap sama", () => {
  const ram = [{ attrKey: "ram", attrValue: "16 GB" }];
  assert.equal(isRequirementSatisfied({ key: "memori", value: "8 GB" }, ram), true);
  assert.equal(isRequirementSatisfied({ key: "Processor", value: "i5" }, [
    { attrKey: "prosesor", attrValue: "i5" },
  ]), true);
});

test("atribut khusus di luar knowledge base tetap dicocokkan apa adanya", () => {
  const custom = [{ attrKey: "Bahan Casing", attrValue: "Aluminium" }];
  assert.equal(isRequirementSatisfied({ key: "bahan casing", value: "aluminium" }, custom), true);
  assert.equal(isRequirementSatisfied({ key: "bahan casing", value: "plastik" }, custom), false);
});

test("nilai teks tetap butuh kecocokan persis, bukan substring", () => {
  const warna = [{ attrKey: "warna", attrValue: "merah muda" }];
  assert.equal(isRequirementSatisfied({ key: "warna", value: "merah" }, warna), false);
});
