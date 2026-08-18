import assert from "node:assert/strict";
import { test } from "node:test";
import { checkSuitability } from "./suitability";

const laptop = {
  name: "Asus Vivobook 14",
  attributes: [
    { attrKey: "ram", attrValue: "16 GB" },
    { attrKey: "storage", attrValue: "1 TB" },
    { attrKey: "prosesor", attrValue: "Intel Core i5" },
    { attrKey: "warna", attrValue: "silver" },
  ],
};

test("semua requirement terpenuhi menghasilkan MATCH", () => {
  const report = checkSuitability(laptop, [
    { key: "ram", value: "8 GB", isHard: true },
    { key: "storage", value: "512 GB", isHard: true },
  ]);
  assert.equal(report.verdict, "MATCH");
  assert.equal(report.score, 100);
  assert.equal(report.hardRequirementsMet, true);
  assert.equal(report.missed.length, 0);
});

test("hard requirement gagal memaksa MISMATCH walau skor lunak tinggi", () => {
  const report = checkSuitability(laptop, [
    { key: "ram", value: "8 GB", isHard: false },
    { key: "storage", value: "512 GB", isHard: false },
    { key: "prosesor", value: "Intel Core i5", isHard: false },
    { key: "warna", value: "silver", isHard: false },
    { key: "gpu", value: "RTX 4060", isHard: true },
  ]);
  assert.equal(report.score, 80, "empat dari lima terpenuhi");
  assert.equal(report.hardRequirementsMet, false);
  assert.equal(report.verdict, "MISMATCH", "hard requirement mengalahkan skor");
});

test("tanpa hard requirement, verdict murni dari skor", () => {
  const report = checkSuitability(laptop, [
    { key: "ram", value: "8 GB" },
    { key: "gpu", value: "RTX 4060" },
  ]);
  assert.equal(report.hardRequirementsTotal, 0);
  assert.equal(report.hardRequirementsMet, null);
  assert.equal(report.score, 50);
  assert.equal(report.verdict, "PARTIAL");
});

test("spesifikasi yang tidak tertera dibedakan dari yang nilainya kurang", () => {
  const report = checkSuitability(laptop, [
    { key: "gpu", value: "RTX 4060" },
    { key: "ram", value: "64 GB" },
  ]);
  const gpu = report.missed.find((m) => m.key === "gpu");
  const ram = report.missed.find((m) => m.key === "ram");
  assert.match(gpu!.reason, /nggak tertera/);
  assert.deepEqual(gpu!.actual, []);
  assert.match(ram!.reason, /nggak memenuhi/);
  assert.deepEqual(ram!.actual, ["16 GB"]);
});

test("nilai produk yang sebenarnya ikut dilaporkan pada yang cocok", () => {
  const report = checkSuitability(laptop, [{ key: "ram", value: "8 GB" }]);
  assert.equal(report.matched[0].actual, "16 GB");
  assert.equal(report.matched[0].required, "8 GB");
});

test("satuan disetarakan lewat predikat yang sama dengan matching engine", () => {
  const report = checkSuitability(laptop, [{ key: "storage", value: "512 GB", isHard: true }]);
  assert.equal(report.verdict, "MATCH", "1 TB harus memenuhi minimal 512 GB");
});

test("preference dihitung terpisah dan tidak pernah mengubah verdict", () => {
  const cocok = checkSuitability(laptop, [{ key: "ram", value: "8 GB", isHard: true }], [
    { key: "warna", value: "silver" },
    { key: "warna", value: "hitam" },
  ]);
  assert.equal(cocok.verdict, "MATCH");
  assert.equal(cocok.preferencesMatched, 1);
  assert.equal(cocok.preferencesMissed.length, 1);

  const tanpaPreference = checkSuitability(laptop, [{ key: "ram", value: "8 GB", isHard: true }]);
  assert.equal(tanpaPreference.verdict, cocok.verdict, "preference tidak boleh mengubah verdict");
});

test("tanpa requirement sama sekali dianggap cocok, bukan gagal", () => {
  const report = checkSuitability(laptop, []);
  assert.equal(report.score, 100);
  assert.equal(report.verdict, "MATCH");
});

test("produk tanpa atribut membuat semua requirement tidak terpenuhi", () => {
  const report = checkSuitability({ name: "Produk Kosong", attributes: [] }, [
    { key: "ram", value: "8 GB", isHard: true },
  ]);
  assert.equal(report.verdict, "MISMATCH");
  assert.equal(report.score, 0);
  assert.match(report.summary, /nggak tertera|nggak terpenuhi/);
});

test("produk tanpa nama tetap punya sebutan di ringkasan", () => {
  const report = checkSuitability({ attributes: [] }, [{ key: "ram", value: "8 GB" }]);
  assert.equal(report.productName, "Produk ini");
  assert.match(report.summary, /^Produk ini/);
});

test("requirement dengan key kosong diabaikan, bukan dihitung gagal", () => {
  const report = checkSuitability(laptop, [
    { key: "", value: "apa saja" },
    { key: "ram", value: "8 GB" },
  ]);
  assert.equal(report.score, 100);
  assert.equal(report.matched.length, 1);
});

test("ringkasan menyebut nama produk dan skornya", () => {
  const report = checkSuitability(laptop, [{ key: "ram", value: "8 GB" }]);
  assert.match(report.summary, /Asus Vivobook 14/);
  assert.match(report.summary, /100/);
});
