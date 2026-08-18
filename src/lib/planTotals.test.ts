import { Prisma } from "@prisma/client";
import assert from "node:assert/strict";
import { test } from "node:test";
import { computePlanTotals } from "./planTotals";

const d = (value: string | number) => new Prisma.Decimal(value);
const items = (...values: (string | number)[]) => values.map((v) => ({ subtotal: d(v) }));

test("plan kosong: total 0, remaining = budget, READY", () => {
  const result = computePlanTotals([], d(1_000_000));
  assert.equal(result.total.toString(), "0");
  assert.equal(result.remaining.toString(), "1000000");
  assert.equal(result.status, "READY");
});

test("di bawah budget -> READY", () => {
  const result = computePlanTotals(items(300_000, 200_000), d(1_000_000));
  assert.equal(result.total.toString(), "500000");
  assert.equal(result.remaining.toString(), "500000");
  assert.equal(result.status, "READY");
});

test("remaining tepat nol tetap READY, bukan NEEDS_ADJUSTMENT", () => {
  const result = computePlanTotals(items(600_000, 400_000), d(1_000_000));
  assert.equal(result.remaining.toString(), "0");
  assert.equal(result.status, "READY");
});

test("melebihi budget satu rupiah -> NEEDS_ADJUSTMENT", () => {
  const result = computePlanTotals(items(1_000_001), d(1_000_000));
  assert.equal(result.remaining.toString(), "-1");
  assert.equal(result.status, "NEEDS_ADJUSTMENT");
});

test("budget 0 = grup tanpa anggaran, tidak pernah NEEDS_ADJUSTMENT", () => {
  const result = computePlanTotals(items(500_000), d(0));
  assert.equal(result.total.toString(), "500000");
  assert.equal(result.status, "READY");
});

test("aritmetika desimal tepat, tanpa error pembulatan float", () => {
  const result = computePlanTotals(items("0.1", "0.2"), d("0.3"));
  assert.equal(result.total.toString(), "0.3");
  assert.equal(result.remaining.toString(), "0");
  assert.equal(result.status, "READY");
});

test("nilai besar tetap presisi", () => {
  const result = computePlanTotals(items("99999999999.99"), d("100000000000.00"));
  assert.equal(result.remaining.toString(), "0.01");
  assert.equal(result.status, "READY");
});
