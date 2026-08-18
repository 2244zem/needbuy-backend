import assert from "node:assert/strict";
import { test } from "node:test";
import { dashboardQuerySchema, recentOrdersQuerySchema, topNeedsQuerySchema } from "./schema";

test("dashboardQuerySchema memvalidasi period enum dan date range", () => {
  assert.equal(dashboardQuerySchema.safeParse({ period: "month" }).success, true);
  assert.equal(dashboardQuerySchema.safeParse({ period: "day" }).success, true);
  assert.equal(dashboardQuerySchema.safeParse({ period: "week" }).success, true);
  assert.equal(dashboardQuerySchema.safeParse({ period: "year" }).success, true);
  assert.equal(dashboardQuerySchema.safeParse({ period: "invalid" }).success, false);
});

test("topNeedsQuerySchema memvalidasi limit", () => {
  const result = topNeedsQuerySchema.safeParse({ limit: 10 });
  assert.equal(result.success, true);
  assert.equal(topNeedsQuerySchema.safeParse({ limit: 0 }).success, false);
  assert.equal(topNeedsQuerySchema.safeParse({ limit: 100 }).success, false);
});

test("recentOrdersQuerySchema memvalidasi limit dan status", () => {
  assert.equal(recentOrdersQuerySchema.safeParse({ limit: 5, status: "DELIVERED" }).success, true);
  assert.equal(recentOrdersQuerySchema.safeParse({ limit: -1 }).success, false);
});
