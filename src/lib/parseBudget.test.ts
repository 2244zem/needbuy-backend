import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBudget } from "./parseBudget";

test("parseBudget: satuan juta", () => {
  assert.equal(parseBudget("laptop budget 12 juta"), 12_000_000);
  assert.equal(parseBudget("budget 12jt"), 12_000_000);
  assert.equal(parseBudget("budget 12 jt aja"), 12_000_000);
  assert.equal(parseBudget("sekitar 1,5 juta"), 1_500_000);
  assert.equal(parseBudget("sekitar 1.5 juta"), 1_500_000);
});

test("parseBudget: satuan ribu", () => {
  assert.equal(parseBudget("budget 500rb"), 500_000);
  assert.equal(parseBudget("budget 500 ribu"), 500_000);
});

test("parseBudget: satuan milyar", () => {
  assert.equal(parseBudget("budget 2 milyar"), 2_000_000_000);
});

test("parseBudget: format bergrup dengan dan tanpa Rp", () => {
  assert.equal(parseBudget("Rp12.000.000"), 12_000_000);
  assert.equal(parseBudget("harga 12.000.000 saja"), 12_000_000);
  assert.equal(parseBudget("Rp 12000000"), 12_000_000);
});

test("parseBudget: angka polos yang cukup besar", () => {
  assert.equal(parseBudget("budget 750000"), 750_000);
});

test("parseBudget: angka kecil bukan budget", () => {
  assert.equal(parseBudget("laptop RAM 16 GB layar 14 inch"), null);
  assert.equal(parseBudget("butuh 3 buah"), null);
});

test("parseBudget: input tidak relevan mengembalikan null", () => {
  assert.equal(parseBudget(""), null);
  assert.equal(parseBudget("laptop buat kuliah"), null);
  assert.equal(parseBudget("tidak ada angka sama sekali"), null);
});

test("parseBudget: satuan menang atas angka polos di kalimat yang sama", () => {
  assert.equal(parseBudget("RAM 16GB, budget 12 juta"), 12_000_000);
});

test("parseBudget: angka dalam kata", () => {
  assert.equal(parseBudget("budget sejuta aja"), 1_000_000);
  assert.equal(parseBudget("dana dua juta"), 2_000_000);
  assert.equal(parseBudget("sekitar sepuluh juta"), 10_000_000);
  assert.equal(parseBudget("setengah juta cukup"), 500_000);
  assert.equal(parseBudget("lima ratus ribu"), 500_000);
  assert.equal(parseBudget("seratus ribu"), 100_000);
});

test("parseBudget: akhiran -an ala percakapan", () => {
  assert.equal(parseBudget("budget 2jtan"), 2_000_000);
  assert.equal(parseBudget("hp 3 jt-an"), 3_000_000);
  assert.equal(parseBudget("sekitar 500rban"), 500_000);
});

test("parseBudget: rentang diambil batas atasnya", () => {
  assert.equal(parseBudget("budget 2-3jt"), 3_000_000);
  assert.equal(parseBudget("kisaran 5 sampai 7 juta"), 7_000_000);
  assert.equal(parseBudget("1 hingga 2 milyar"), 2_000_000_000);
});

test("parseBudget: kata biasa tidak salah dibaca jadi angka", () => {
  assert.equal(parseBudget("kulkas dua pintu"), null);
  assert.equal(parseBudget("sesuatu yang menyenangkan"), null);
});
