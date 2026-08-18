import assert from "node:assert/strict";
import { test } from "node:test";
import { routeQuestion } from "./productQuestion";

test("pertanyaan atribut dirutekan ke key produk", () => {
  assert.deepEqual(routeQuestion("ramnya berapa?"), { kind: "attribute", key: "ram" });
  assert.deepEqual(routeQuestion("layarnya berapa inch"), { kind: "attribute", key: "layar" });
  assert.deepEqual(routeQuestion("baterainya berapa mah"), { kind: "attribute", key: "baterai" });
  assert.deepEqual(routeQuestion("garansinya berapa lama"), { kind: "attribute", key: "garansi" });
});

test("ragam bahasa Inggris dan sinonim ikut terbaca", () => {
  assert.deepEqual(routeQuestion("what is the storage"), { kind: "attribute", key: "storage" });
  assert.deepEqual(routeQuestion("processornya apa"), { kind: "attribute", key: "prosesor" });
  
  assert.deepEqual(routeQuestion("memori berapa"), { kind: "attribute", key: "ram" });
});

test("pertanyaan harga, stok, dan penjual punya jalur sendiri", () => {
  assert.deepEqual(routeQuestion("berapa harganya?"), { kind: "price" });
  assert.deepEqual(routeQuestion("ini mahal ga"), { kind: "price" });
  assert.deepEqual(routeQuestion("stoknya masih ada?"), { kind: "stock" });
  assert.deepEqual(routeQuestion("ready ga barangnya"), { kind: "stock" });
  assert.deepEqual(routeQuestion("dijual oleh toko apa"), { kind: "seller" });
});

test("harga diperiksa lebih dulu daripada atribut", () => {
  assert.deepEqual(routeQuestion("berapa harga yang ram 16gb"), { kind: "price" });
});

test("pertanyaan di luar cakupan menghasilkan unknown, bukan tebakan", () => {
  assert.deepEqual(routeQuestion("apakah cocok untuk anak saya?"), { kind: "unknown" });
  assert.deepEqual(routeQuestion("kapan barang sampai"), { kind: "unknown" });
  assert.deepEqual(routeQuestion("bagus ga menurut kamu"), { kind: "unknown" });
});

test("pertanyaan kosong tidak pernah melempar", () => {
  assert.deepEqual(routeQuestion(""), { kind: "unknown" });
  assert.deepEqual(routeQuestion("   "), { kind: "unknown" });
});

test("akhiran -nya tidak memotong kata yang kebetulan berakhiran sama", () => {
  assert.deepEqual(routeQuestion("apa yang dia punya"), { kind: "unknown" });
  
  assert.deepEqual(routeQuestion("stoknya gimana"), { kind: "stock" });
  assert.deepEqual(routeQuestion("harganya berapa"), { kind: "price" });
});
