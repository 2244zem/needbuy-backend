import assert from "node:assert/strict";
import { test } from "node:test";
import {
  budgetScore,
  categoryScore,
  qualityScore,
  score,
  sellerScore,
  type ScoringCandidate,
  type ScoringNeed,
} from "./scoring";

const candidate = (over: Partial<ScoringCandidate> = {}): ScoringCandidate => ({
  price: 1_000_000,
  rating: 5,
  categoryId: "cat-1",
  attributes: [{ attrKey: "ram", attrValue: "16GB" }],
  seller: { rating: 5, status: "ACTIVE" },
  ...over,
});

const need = (over: Partial<ScoringNeed> = {}): ScoringNeed => ({
  categoryId: "cat-1",
  budget: 1_000_000,
  softRequirements: [],
  preferences: [],
  ...over,
});

test("categoryScore: cocok persis 100, beda 60, need tanpa kategori 100", () => {
  assert.equal(categoryScore("cat-1", "cat-1"), 100);
  assert.equal(categoryScore("cat-2", "cat-1"), 60);
  assert.equal(categoryScore("cat-2", null), 100);
});

test("budgetScore: turun linear melintasi pita toleransi", () => {
  assert.equal(budgetScore(900_000, 1_000_000), 100, "di bawah budget");
  assert.equal(budgetScore(1_000_000, 1_000_000), 100, "tepat di budget");
  
  assert.equal(budgetScore(1_150_000, 1_000_000), 0, "tepat di plafon toleransi");
  assert.equal(budgetScore(1_200_000, 1_000_000), 0, "di atas plafon");
  
  assert.equal(budgetScore(1_075_000, 1_000_000), 50, "tengah pita toleransi");
});

test("budgetScore: budget null bersifat netral, bukan menghukum", () => {
  assert.equal(budgetScore(999_999_999, null), 100);
});

test("qualityScore memetakan rating 0-5 ke 0-100", () => {
  assert.equal(qualityScore(5), 100);
  assert.equal(qualityScore(4), 80);
  assert.equal(qualityScore(0), 0);
});

test("sellerScore: seller SUSPENDED dipaksa 0 walau rating tinggi", () => {
  assert.equal(sellerScore(5, "ACTIVE"), 100);
  assert.equal(sellerScore(5, "SUSPENDED"), 0);
});

test("requirement/preference kosong bernilai netral 100, bukan NaN", () => {
  const result = score(candidate(), need());
  assert.equal(result.requirementScore, 100);
  assert.equal(result.preferenceScore, 100);
  assert.ok(!Number.isNaN(result.matchScore));
});

test("soft requirement terpenuhi sebagian menghasilkan rasio", () => {
  const result = score(
    candidate({ attributes: [{ attrKey: "ram", attrValue: "16GB" }] }),
    need({
      softRequirements: [
        { key: "ram", value: "8GB" },
        { key: "storage", value: "512GB" },
      ],
    })
  );
  assert.equal(result.requirementScore, 50, "1 dari 2 terpenuhi");
});

test("preference berbobot dinormalisasi dengan total bobot", () => {
  const result = score(
    candidate({ attributes: [{ attrKey: "berat", attrValue: "ringan" }] }),
    need({
      preferences: [
        { key: "berat", value: "ringan", weight: 3 },
        { key: "kelas", value: "premium", weight: 1 },
      ],
    })
  );
  assert.equal(result.preferenceScore, 75, "bobot 3 dari total 4");
});

test("kandidat sempurna mendapat matchScore 100", () => {
  const result = score(candidate(), need());
  assert.equal(result.matchScore, 100);
});

test("matchScore selalu berada di rentang 0-100", () => {
  const worst = score(
    candidate({ price: 10_000_000, rating: 0, categoryId: "lain", seller: { rating: 0, status: "SUSPENDED" } }),
    need({ softRequirements: [{ key: "ram", value: "64GB" }] })
  );
  assert.ok(worst.matchScore >= 0 && worst.matchScore <= 100, `${worst.matchScore}`);
});
