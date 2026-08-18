import assert from "node:assert/strict";
import { test } from "node:test";
import { hashRequestBody, randomToken, safeCompare, sha256 } from "./hash";

test("sha256 stabil dan panjangnya benar", () => {
  assert.equal(sha256("a").length, 64);
  assert.equal(sha256("a"), sha256("a"));
  assert.notEqual(sha256("a"), sha256("b"));
});

test("safeCompare benar untuk sama, beda, dan beda panjang", () => {
  assert.equal(safeCompare("abc", "abc"), true);
  assert.equal(safeCompare("abc", "abd"), false);
  
  assert.equal(safeCompare("abc", "abcd"), false);
  assert.equal(safeCompare("", ""), true);
});

test("hashRequestBody tidak peduli urutan key", () => {
  assert.equal(hashRequestBody({ a: 1, b: 2 }), hashRequestBody({ b: 2, a: 1 }));
});

test("hashRequestBody membedakan isi yang berbeda", () => {
  assert.notEqual(hashRequestBody({ a: 1 }), hashRequestBody({ a: 2 }));
  assert.notEqual(hashRequestBody({ qty: 1 }), hashRequestBody({ qty: "1" }));
});

test("hashRequestBody menghormati urutan array", () => {
  assert.notEqual(hashRequestBody({ items: [1, 2] }), hashRequestBody({ items: [2, 1] }));
});

test("hashRequestBody menangani nested dan null", () => {
  assert.equal(
    hashRequestBody({ a: { x: 1, y: null } }),
    hashRequestBody({ a: { y: null, x: 1 } })
  );
});

test("randomToken unik dan cukup panjang", () => {
  const tokens = new Set(Array.from({ length: 500 }, () => randomToken(32)));
  assert.equal(tokens.size, 500);
  assert.equal(randomToken(32).length, 64);
});
