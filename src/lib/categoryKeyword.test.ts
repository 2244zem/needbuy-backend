import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesAsWord } from "../modules/categories/service";

test("frasa hanya cocok sebagai kata utuh", () => {
  assert.equal(matchesAsWord("butuh macbook pro", "ac"), false);
  assert.equal(matchesAsWord("cari jacket denim", "ac"), false);
  assert.equal(matchesAsWord("cari backpack", "ac"), false);
  assert.equal(matchesAsWord("mau beli ac 1 pk", "ac"), true);
  assert.equal(matchesAsWord("pasang AC di kamar", "ac"), true);
});

test("frasa berspasi tetap cocok walau spasinya berlebih", () => {
  assert.equal(matchesAsWord("cari mesin  cuci 8kg", "mesin cuci"), true);
  assert.equal(matchesAsWord("cari mesin cuci", "mesin cuci"), true);
});

test("angka di sekitar frasa dihitung sebagai batas yang menempel", () => {
  assert.equal(matchesAsWord("beli tv55", "tv"), false);
  assert.equal(matchesAsWord("beli tv 55 inch", "tv"), true);
});

test("frasa kosong tidak pernah cocok", () => {
  assert.equal(matchesAsWord("apa saja", ""), false);
  assert.equal(matchesAsWord("apa saja", "   "), false);
});

test("karakter regex di nama kategori tidak memecah pencocokan", () => {
  assert.doesNotThrow(() => matchesAsWord("kelas c++ lanjutan", "c++"));
  assert.doesNotThrow(() => matchesAsWord("perlengkapan anak & bayi", "anak & bayi"));
  assert.equal(matchesAsWord("perlengkapan anak & bayi murah", "anak & bayi"), true);
});
