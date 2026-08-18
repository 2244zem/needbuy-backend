import assert from "node:assert/strict";
import { test } from "node:test";
import {
  listAuditLogsQuery,
  listStoresQuery,
  listUsersQuery,
  setSellerStatusSchema,
} from "./schema";

test("status toko dibatasi ACTIVE dan SUSPENDED", () => {
  assert.equal(setSellerStatusSchema.safeParse({ status: "ACTIVE" }).success, true);
  assert.equal(setSellerStatusSchema.safeParse({ status: "SUSPENDED" }).success, true);
  assert.equal(setSellerStatusSchema.safeParse({ status: "DELETED" }).success, false);
  assert.equal(setSellerStatusSchema.safeParse({}).success, false);
});

test("alasan opsional tapi dibatasi panjangnya", () => {
  assert.equal(
    setSellerStatusSchema.safeParse({ status: "SUSPENDED", reason: "penipuan" }).success,
    true
  );
  assert.equal(
    setSellerStatusSchema.safeParse({ status: "SUSPENDED", reason: "x".repeat(501) }).success,
    false
  );
});

test("setSellerStatus menolak field asing", () => {
  const result = setSellerStatusSchema.safeParse({ status: "ACTIVE", rating: 5 });
  assert.equal(result.success, false);
});

test("filter role dibatasi enum yang sah", () => {
  assert.equal(listUsersQuery.safeParse({ role: "ADMIN" }).success, true);
  assert.equal(listUsersQuery.safeParse({ role: "SUPERADMIN" }).success, false);
});

test("query admin tidak menerima field sortir bebas", () => {
  assert.equal(listUsersQuery.safeParse({ orderBy: "passwordHash" }).success, false);
  assert.equal(listAuditLogsQuery.safeParse({ select: "*" }).success, false);
});

test("paginasi admin tetap dibatasi 100", () => {
  assert.equal(listUsersQuery.safeParse({ limit: 101 }).success, false);
  assert.equal(listAuditLogsQuery.safeParse({ limit: 101 }).success, false);
  assert.equal(listUsersQuery.safeParse({ limit: 100 }).success, true);
});

test("filter toko: rating dikoersi dari string dan dibatasi 0-5", () => {
  const parsed = listStoresQuery.safeParse({ minRating: "4.5", status: "SUSPENDED" });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.minRating, 4.5);
  assert.equal(listStoresQuery.safeParse({ minRating: 6 }).success, false);
  assert.equal(listStoresQuery.safeParse({ status: "INACTIVE" }).success, false);
  assert.equal(listStoresQuery.safeParse({ orderBy: "revenue" }).success, false);
});

test("actorUserId pada audit log harus uuid", () => {
  assert.equal(listAuditLogsQuery.safeParse({ actorUserId: "bukan-uuid" }).success, false);
  assert.equal(
    listAuditLogsQuery.safeParse({ actorUserId: "11111111-1111-4111-8111-111111111111" }).success,
    true
  );
});
