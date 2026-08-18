import assert from "node:assert/strict";
import { test } from "node:test";
import { createInventSchema, listInventQuery, updateInventSchema } from "./schema";

test("createInventSchema: memvalidasi input wajib", () => {
  const valid = createInventSchema.safeParse({
    name: "Produk Inventori Test",
    categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    price: 150000,
    stock: 25,
    sku: "SKU-TEST-001",
  });
  assert.equal(valid.success, true);
});

test("createInventSchema: menolak harga atau stok negatif", () => {
  const invalidPrice = createInventSchema.safeParse({
    name: "Produk Inventori Test",
    categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    price: -500,
    stock: 10,
  });
  assert.equal(invalidPrice.success, false);

  const invalidStock = createInventSchema.safeParse({
    name: "Produk Inventori Test",
    categoryId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    price: 10000,
    stock: -2,
  });
  assert.equal(invalidStock.success, false);
});

test("updateInventSchema: menolak body kosong", () => {
  const result = updateInventSchema.safeParse({});
  assert.equal(result.success, false);
});

test("listInventQuery: nilai default paginasi", () => {
  const parsed = listInventQuery.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.limit, 20);
});
