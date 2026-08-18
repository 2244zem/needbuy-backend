import assert from "node:assert/strict";
import { test } from "node:test";
import {
  generateMidtransOrderId,
  generateOrderNumber,
  orderNumberFromMidtransOrderId,
} from "./orderNumber";

test("generateOrderNumber memakai format NB-{timestamp}-{random}", () => {
  const now = new Date("2026-08-10T00:00:00.000Z");
  const value = generateOrderNumber(now);
  assert.match(value, /^NB-\d+-[0-9A-F]{10}$/);
  assert.ok(value.includes(String(now.getTime())));
});

test("generateOrderNumber unik walau dipanggil di milidetik yang sama", () => {
  const now = new Date();
  const generated = new Set(Array.from({ length: 2000 }, () => generateOrderNumber(now)));
  assert.equal(generated.size, 2000);
});

test("panjang midtransOrderId aman di bawah batas 50 karakter Midtrans", () => {
  const value = generateMidtransOrderId(generateOrderNumber());
  assert.ok(value.length <= 50, `panjangnya ${value.length}: ${value}`);
});

test("midtransOrderId berbeda tiap panggilan untuk order yang sama", () => {
  const orderNumber = "NB-123-ABCDEF";
  const first = generateMidtransOrderId(orderNumber);
  const second = generateMidtransOrderId(orderNumber);
  assert.notEqual(first, second);
  assert.ok(first.startsWith(orderNumber));
});

test("orderNumberFromMidtransOrderId mengembalikan order_number aslinya", () => {
  const orderNumber = generateOrderNumber();
  const midtransOrderId = generateMidtransOrderId(orderNumber);
  assert.equal(orderNumberFromMidtransOrderId(midtransOrderId), orderNumber);
});

test("orderNumberFromMidtransOrderId menolak id yang bukan format kita", () => {
  assert.equal(orderNumberFromMidtransOrderId("ORDER-123"), null);
  assert.equal(orderNumberFromMidtransOrderId("NB-123-ABC"), null);
  assert.equal(orderNumberFromMidtransOrderId(""), null);
  assert.equal(orderNumberFromMidtransOrderId("XX-1-2-3"), null);
});
