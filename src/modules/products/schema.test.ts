import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addAttributeSchema,
  createProductSchema,
  listProductsQuery,
  updateImageSchema,
  updateProductSchema,
} from "./products.schema";

const validProduct = {
  name: "Laptop Demo",
  categoryId: "11111111-1111-4111-8111-111111111111",
  price: "7500000.00",
  stock: 10,
};

test("createProduct menolak sellerId, rating, dan soldCount dari body", () => {
  for (const extra of [
    { sellerId: "22222222-2222-4222-8222-222222222222" },
    { rating: 5 },
    { soldCount: 9999 },
    { isActive: true },
    { id: "33333333-3333-4333-8333-333333333333" },
  ]) {
    assert.equal(
      createProductSchema.safeParse({ ...validProduct, ...extra }).success,
      false,
      `field ${Object.keys(extra)[0]} seharusnya ditolak`
    );
  }
});

test("updateProduct juga menolak rating dan soldCount", () => {
  assert.equal(updateProductSchema.safeParse({ rating: 5 }).success, false);
  assert.equal(updateProductSchema.safeParse({ soldCount: 100 }).success, false);
  assert.equal(updateProductSchema.safeParse({ sellerId: "x" }).success, false);
});

test("harga menolak nilai negatif dan format aneh", () => {
  assert.equal(createProductSchema.safeParse({ ...validProduct, price: "-1" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, price: "1e5" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, price: "10.999" }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, price: "10.99" }).success, true);
});

test("stock menolak negatif dan pecahan", () => {
  assert.equal(createProductSchema.safeParse({ ...validProduct, stock: -1 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, stock: 1.5 }).success, false);
  assert.equal(createProductSchema.safeParse({ ...validProduct, stock: 0 }).success, true);
});

test("sort dibatasi allowlist", () => {
  assert.equal(listProductsQuery.safeParse({ sort: "price_asc" }).success, true);
  assert.equal(listProductsQuery.safeParse({ sort: "passwordHash" }).success, false);
  assert.equal(listProductsQuery.safeParse({ sort: "id" }).success, false);
});

test("limit dibatasi maksimum 100", () => {
  assert.equal(listProductsQuery.safeParse({ limit: 100 }).success, true);
  assert.equal(listProductsQuery.safeParse({ limit: 101 }).success, false);
  assert.equal(listProductsQuery.safeParse({ page: 0 }).success, false);
});

test("minPrice tidak boleh melebihi maxPrice", () => {
  assert.equal(listProductsQuery.safeParse({ minPrice: 100, maxPrice: 50 }).success, false);
  assert.equal(listProductsQuery.safeParse({ minPrice: 50, maxPrice: 100 }).success, true);
});

test("updateImage butuh minimal satu field", () => {
  assert.equal(updateImageSchema.safeParse({}).success, false);
  assert.equal(updateImageSchema.safeParse({ isPrimary: true }).success, true);
  assert.equal(updateImageSchema.safeParse({ sortOrder: 3 }).success, true);
});

test("updateImage menolak penggantian url", () => {
  assert.equal(updateImageSchema.safeParse({ url: "https://x.test/a.jpg" }).success, false);
});

test("addAttribute menolak key/value kosong dan kepanjangan", () => {
  assert.equal(addAttributeSchema.safeParse({ attrKey: "ram", attrValue: "16GB" }).success, true);
  assert.equal(addAttributeSchema.safeParse({ attrKey: "", attrValue: "16GB" }).success, false);
  assert.equal(addAttributeSchema.safeParse({ attrKey: "ram", attrValue: "" }).success, false);
  assert.equal(
    addAttributeSchema.safeParse({ attrKey: "a".repeat(61), attrValue: "x" }).success,
    false
  );
});

test("addAttribute menolak productId dari body", () => {
  const result = addAttributeSchema.safeParse({
    attrKey: "ram",
    attrValue: "16GB",
    productId: "44444444-4444-4444-8444-444444444444",
  });
  assert.equal(result.success, false);
});
