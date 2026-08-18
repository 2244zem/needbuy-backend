import assert from "node:assert/strict";
import { test } from "node:test";
import { explanationFor, labelFor, rankAll } from "./ranking";
import type { ScoreComponents } from "./scoring";

test("labelFor tepat di setiap ambang batas", () => {
  assert.equal(labelFor(100), "BEST_MATCH");
  assert.equal(labelFor(85), "BEST_MATCH");
  assert.equal(labelFor(84.99), "GOOD_MATCH");
  assert.equal(labelFor(70), "GOOD_MATCH");
  assert.equal(labelFor(69.99), "ALTERNATIVE");
  assert.equal(labelFor(0), "ALTERNATIVE");
});

test("rankAll mengurutkan menurun dan memberi ranking 1-based", () => {
  const ranked = rankAll([
    { id: "b", matchScore: 70 },
    { id: "a", matchScore: 90 },
    { id: "c", matchScore: 50 },
  ]);

  assert.deepEqual(
    ranked.map((item) => [item.id, item.ranking, item.label]),
    [
      ["a", 1, "BEST_MATCH"],
      ["b", 2, "GOOD_MATCH"],
      ["c", 3, "ALTERNATIVE"],
    ]
  );
});

test("rankAll deterministik saat skor seri", () => {
  const first = rankAll([
    { id: "z", matchScore: 80 },
    { id: "a", matchScore: 80 },
  ]);
  const second = rankAll([
    { id: "a", matchScore: 80 },
    { id: "z", matchScore: 80 },
  ]);
  
  assert.deepEqual(
    first.map((item) => item.id),
    second.map((item) => item.id)
  );
});

test("rankAll tidak memutasi array masukan", () => {
  const input = [
    { id: "b", matchScore: 70 },
    { id: "a", matchScore: 90 },
  ];
  rankAll(input);
  assert.equal(input[0].id, "b");
});

const components = (over: Partial<ScoreComponents> = {}): ScoreComponents => ({
  categoryScore: 50,
  budgetScore: 50,
  requirementScore: 50,
  preferenceScore: 50,
  qualityScore: 50,
  sellerScore: 50,
  matchScore: 50,
  ...over,
});

test("explanationFor menyebut dua komponen tertinggi", () => {
  const text = explanationFor(components({ budgetScore: 100, sellerScore: 90 }));
  assert.match(text, /budget/i);
  assert.match(text, /penjual/i);
});

test("explanationFor melewati komponen yang netral karena tidak disebut user", () => {
  const text = explanationFor(components({ preferenceScore: 100, budgetScore: 90 }), [
    "preferenceScore",
  ]);
  assert.doesNotMatch(text, /preferensi/i);
});
