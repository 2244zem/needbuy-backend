import assert from "node:assert/strict";
import { test } from "node:test";
import { BUDGET_TOLERANCE, LABEL_THRESHOLDS, SCORING_WEIGHTS, WEIGHT_SUM } from "./scoringWeights";

test("bobot scoring berjumlah tepat 1.0", () => {
  assert.ok(Math.abs(WEIGHT_SUM - 1) < 1e-9, `WEIGHT_SUM = ${WEIGHT_SUM}`);
});

test("keenam komponen bobot ada semua", () => {
  assert.deepEqual(Object.keys(SCORING_WEIGHTS).sort(), [
    "budget",
    "category",
    "preference",
    "quality",
    "requirement",
    "seller",
  ]);
});

test("konstanta ambang sesuai spesifikasi", () => {
  assert.equal(LABEL_THRESHOLDS.bestMatch, 85);
  assert.equal(LABEL_THRESHOLDS.goodMatch, 70);
  assert.equal(BUDGET_TOLERANCE, 0.15);
});
