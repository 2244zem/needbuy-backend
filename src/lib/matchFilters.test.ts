import assert from "node:assert/strict";
import { test } from "node:test";
import { filterCandidates, passesHardRequirements, passesStockAndBudget } from "./matchFilters";

const product = (over: Partial<{ stock: number; price: number; attributes: { attrKey: string; attrValue: string }[] }> = {}) => ({
  stock: 5,
  price: 1_000_000,
  attributes: [{ attrKey: "ram", attrValue: "16GB" }],
  ...over,
});

test("stok habis selalu gugur", () => {
  assert.equal(passesStockAndBudget(product({ stock: 0 }), 10_000_000), false);
  assert.equal(passesStockAndBudget(product({ stock: -1 }), 10_000_000), false);
});

test("harga dalam pita toleransi 15% masih lolos sebagai alternatif", () => {
  assert.equal(passesStockAndBudget(product({ price: 1_000_000 }), 1_000_000), true);
  assert.equal(passesStockAndBudget(product({ price: 1_150_000 }), 1_000_000), true, "tepat di plafon");
  assert.equal(passesStockAndBudget(product({ price: 1_150_001 }), 1_000_000), false, "lewat plafon");
});

test("budget null tidak menyaring harga apa pun", () => {
  assert.equal(passesStockAndBudget(product({ price: 999_999_999 }), null), true);
});

test("satu hard requirement gagal = produk gugur", () => {
  const candidate = product();
  assert.equal(passesHardRequirements(candidate, [{ key: "ram", value: "8GB" }]), true);
  assert.equal(
    passesHardRequirements(candidate, [
      { key: "ram", value: "8GB" },
      { key: "storage", value: "1TB" },
    ]),
    false,
    "satu tidak terpenuhi, seluruhnya gugur"
  );
});

test("tanpa hard requirement, semua lolos", () => {
  assert.equal(passesHardRequirements(product(), []), true);
});

test("hard requirement numerik memakai perbandingan >=", () => {
  const candidate = product({ attributes: [{ attrKey: "ram", attrValue: "16GB" }] });
  assert.equal(passesHardRequirements(candidate, [{ key: "ram", value: "32GB" }]), false);
  assert.equal(passesHardRequirements(candidate, [{ key: "ram", value: "16GB" }]), true);
});

test("filterCandidates menerapkan ketiga saringan berurutan", () => {
  const candidates = [
    { id: "ok", ...product() },
    { id: "habis", ...product({ stock: 0 }) },
    { id: "mahal", ...product({ price: 5_000_000 }) },
    { id: "ram-kurang", ...product({ attributes: [{ attrKey: "ram", attrValue: "4GB" }] }) },
  ];

  const survivors = filterCandidates(candidates, {
    budget: 1_000_000,
    hardRequirements: [{ key: "ram", value: "8GB" }],
  });

  assert.deepEqual(
    survivors.map((item) => item.id),
    ["ok"]
  );
});
