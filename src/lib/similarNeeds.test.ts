import assert from "node:assert/strict";
import { test } from "node:test";
import { findSimilarNeeds, jaccard, needTokens } from "./similarNeeds";

const needs = [
  { id: "a", goal: "Laptop untuk desain grafis", rawInput: "butuh laptop desain grafis ram besar" },
  { id: "b", goal: "Laptop untuk desain", rawInput: "cari laptop buat desain grafis" },
  { id: "c", goal: "Kulkas dua pintu", rawInput: "mau beli kulkas hemat listrik" },
  { id: "d", goal: null, rawInput: null },
];

test("jaccard himpunan identik bernilai 1", () => {
  assert.equal(jaccard(new Set(["a", "b"]), new Set(["b", "a"])), 1);
});

test("jaccard tanpa irisan bernilai 0", () => {
  assert.equal(jaccard(new Set(["a"]), new Set(["b"])), 0);
});

test("dua himpunan kosong bernilai 0, bukan 1", () => {
  assert.equal(jaccard(new Set(), new Set()), 0);
});

test("need paling mirip muncul lebih dulu", () => {
  const hasil = findSimilarNeeds("a", needs);
  assert.equal(hasil[0].id, "b");
});

test("need target tidak pernah muncul di hasilnya sendiri", () => {
  assert.equal(
    findSimilarNeeds("a", needs).find((n) => n.id === "a"),
    undefined
  );
});

test("need dengan skor nol dibuang, bukan diletakkan di ekor", () => {
  const hasil = findSimilarNeeds("a", needs);
  assert.ok(hasil.every((n) => n.score > 0));
  assert.equal(hasil.find((n) => n.id === "d"), undefined);
});

test("need yang tidak ada menghasilkan daftar kosong", () => {
  assert.deepEqual(findSimilarNeeds("entah", needs), []);
});

test("limit dipatuhi", () => {
  assert.ok(findSimilarNeeds("a", needs, 1).length <= 1);
  assert.deepEqual(findSimilarNeeds("a", needs, 0), []);
});

test("stopword tidak ikut menaikkan kemiripan", () => {
  const tokens = needTokens({ id: "x", goal: "yang dan untuk", rawInput: "" });
  assert.equal(tokens.size, 0);
});

test("urutan stabil untuk skor yang sama", () => {
  const kembar = [
    { id: "target", goal: "laptop gaming", rawInput: "" },
    { id: "z", goal: "laptop gaming", rawInput: "" },
    { id: "y", goal: "laptop gaming", rawInput: "" },
  ];
  assert.deepEqual(
    findSimilarNeeds("target", kembar).map((n) => n.id),
    ["y", "z"]
  );
});
