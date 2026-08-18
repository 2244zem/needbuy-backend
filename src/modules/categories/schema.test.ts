import assert from "node:assert/strict";
import { test } from "node:test";
import { createCategorySchema, updateCategorySchema } from "./schema";

test("createCategory menerima name saja, slug opsional", () => {
  assert.equal(createCategorySchema.safeParse({ name: "Elektronik" }).success, true);
  assert.equal(
    createCategorySchema.safeParse({ name: "Elektronik", slug: "elektronik" }).success,
    true
  );
});

test("slug menolak bentuk yang tidak aman untuk URL", () => {
  for (const slug of [
    "Elektronik",
    "elektronik rumah",
    "elektronik/rumah",
    "-elektronik",
    "elektronik-",
    "elektronik--rumah",
    "elektronik!",
    "",
  ]) {
    assert.equal(
      createCategorySchema.safeParse({ name: "Elektronik", slug }).success,
      false,
      `slug "${slug}" seharusnya ditolak`
    );
  }
});

test("slug menerima bentuk yang benar", () => {
  for (const slug of ["elektronik", "elektronik-rumah", "hp-2024", "a1"]) {
    assert.equal(
      createCategorySchema.safeParse({ name: "Kategori", slug }).success,
      true,
      `slug "${slug}" seharusnya diterima`
    );
  }
});

test("parentId harus uuid atau null", () => {
  assert.equal(createCategorySchema.safeParse({ name: "Kategori", parentId: null }).success, true);
  assert.equal(createCategorySchema.safeParse({ name: "Kategori", parentId: "bukan-uuid" }).success, false);
});

test("createCategory menolak field asing", () => {
  const result = createCategorySchema.safeParse({
    name: "Kategori",
    
    id: "uuid-palsu",
    createdAt: "2020-01-01",
  });
  assert.equal(result.success, false);
});

test("updateCategory menolak body kosong", () => {
  assert.equal(updateCategorySchema.safeParse({}).success, false);
});

test("updateCategory mengizinkan melepas induk dengan null", () => {
  assert.equal(updateCategorySchema.safeParse({ parentId: null }).success, true);
});

test("nama kategori punya batas panjang", () => {
  assert.equal(createCategorySchema.safeParse({ name: "a" }).success, false);
  assert.equal(createCategorySchema.safeParse({ name: "a".repeat(101) }).success, false);
});
