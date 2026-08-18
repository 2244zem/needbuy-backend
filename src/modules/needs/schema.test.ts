import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addPreferenceSchema,
  addRequirementSchema,
  createNeedSchema,
  updateNeedSchema,
} from "./schema";

test("createNeed menolak rawInput kosong dan terlalu pendek", () => {
  assert.equal(createNeedSchema.safeParse({ rawInput: "" }).success, false);
  assert.equal(createNeedSchema.safeParse({ rawInput: "abc" }).success, false);
  assert.equal(createNeedSchema.safeParse({ rawInput: "laptop kuliah" }).success, true);
});

test("createNeed menolak payload raksasa", () => {
  const huge = "a".repeat(2001);
  assert.equal(createNeedSchema.safeParse({ rawInput: huge }).success, false);
});

test("createNeed menolak field asing", () => {
  const result = createNeedSchema.safeParse({
    rawInput: "laptop kuliah",
    userId: "korban-lain",
    status: "COMPLETED",
  });
  assert.equal(result.success, false);
});

test("updateNeed menolak budget negatif dan nol", () => {
  assert.equal(updateNeedSchema.safeParse({ budget: -1 }).success, false);
  assert.equal(updateNeedSchema.safeParse({ budget: 0 }).success, false);
  assert.equal(updateNeedSchema.safeParse({ budget: 12_000_000 }).success, true);
});

test("updateNeed mengizinkan budget null untuk menghapusnya", () => {
  assert.equal(updateNeedSchema.safeParse({ budget: null }).success, true);
});

test("updateNeed menolak perubahan rawInput dan status", () => {
  assert.equal(updateNeedSchema.safeParse({ rawInput: "diganti" }).success, false);
  assert.equal(updateNeedSchema.safeParse({ status: "COMPLETED" }).success, false);
});

test("updateNeed menolak body kosong", () => {
  assert.equal(updateNeedSchema.safeParse({}).success, false);
});

test("addRequirement mewajibkan isHard eksplisit, tanpa default", () => {
  assert.equal(addRequirementSchema.safeParse({ key: "ram", value: "16GB" }).success, false);

  const explicit = addRequirementSchema.safeParse({ key: "ram", value: "16GB", isHard: false });
  assert.equal(explicit.success, true);
  assert.equal(explicit.success && explicit.data.isHard, false);
});

test("addRequirement menolak key/value kosong dan kepanjangan", () => {
  assert.equal(addRequirementSchema.safeParse({ key: "", value: "16GB", isHard: true }).success, false);
  assert.equal(addRequirementSchema.safeParse({ key: "ram", value: "", isHard: true }).success, false);
  assert.equal(
    addRequirementSchema.safeParse({ key: "a".repeat(61), value: "x", isHard: true }).success,
    false
  );
});

test("addPreference memberi weight default 1 dan mengklamp rentangnya", () => {
  const parsed = addPreferenceSchema.safeParse({ key: "berat", value: "ringan" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.weight, 1);

  assert.equal(
    addPreferenceSchema.safeParse({ key: "berat", value: "ringan", weight: 6 }).success,
    false
  );
  assert.equal(
    addPreferenceSchema.safeParse({ key: "berat", value: "ringan", weight: -1 }).success,
    false
  );
});

test("addPreference tidak menerima isHard", () => {
  const result = addPreferenceSchema.safeParse({
    key: "berat",
    value: "ringan",
    isHard: true,
  });
  assert.equal(result.success, false);
});
