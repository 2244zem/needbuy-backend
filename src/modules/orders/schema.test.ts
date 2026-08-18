import assert from "node:assert/strict";
import { test } from "node:test";
import { listOrdersQuery, updateStatusSchema } from "./schema";

test("client hanya boleh meminta SHIPPED, DELIVERED, COMPLETED", () => {
  for (const status of ["SHIPPED", "DELIVERED", "COMPLETED"]) {
    assert.equal(updateStatusSchema.safeParse({ status }).success, true, status);
  }
});

test("PROCESSING tidak bisa diminta client", () => {
  assert.equal(updateStatusSchema.safeParse({ status: "PROCESSING" }).success, false);
});

test("WAITING_PAYMENT dan CANCELLED tidak lewat endpoint status", () => {
  assert.equal(updateStatusSchema.safeParse({ status: "CANCELLED" }).success, false);
  assert.equal(updateStatusSchema.safeParse({ status: "WAITING_PAYMENT" }).success, false);
});

test("status karangan ditolak", () => {
  assert.equal(updateStatusSchema.safeParse({ status: "PAID" }).success, false);
  assert.equal(updateStatusSchema.safeParse({ status: "" }).success, false);
  assert.equal(updateStatusSchema.safeParse({}).success, false);
});

test("updateStatus menolak field asing", () => {
  const result = updateStatusSchema.safeParse({ status: "SHIPPED", sellerId: "orang lain" });
  assert.equal(result.success, false);
});

test("filter status pada daftar order menerima semua status yang sah", () => {
  for (const status of [
    "WAITING_PAYMENT",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "COMPLETED",
    "CANCELLED",
  ]) {
    assert.equal(listOrdersQuery.safeParse({ status }).success, true, status);
  }
});

test("filter status karangan ditolak", () => {
  assert.equal(listOrdersQuery.safeParse({ status: "APAPUN" }).success, false);
});

test("paginasi daftar order dibatasi", () => {
  assert.equal(listOrdersQuery.safeParse({ limit: 101 }).success, false);
  assert.equal(listOrdersQuery.safeParse({ page: 0 }).success, false);
  const parsed = listOrdersQuery.safeParse({});
  assert.equal(parsed.success && parsed.data.limit, 20);
});

test("listOrdersQuery dan exportOrdersQuery menerima parameter pencarian q dan search", () => {
  assert.equal(listOrdersQuery.safeParse({ q: "Budi", status: "PROCESSING" }).success, true);
  assert.equal(listOrdersQuery.safeParse({ search: "NB-12345" }).success, true);
});

test("mapPaymentStatus dan mapShippingStatus mengembalikan label yang sesuai", async () => {
  const { mapPaymentStatus, mapShippingStatus } = await import("./service.js");
  assert.equal(mapPaymentStatus("CANCELLED"), "Dibatalkan");
  assert.equal(mapPaymentStatus("COMPLETED"), "Selesai");
  assert.equal(mapPaymentStatus("WAITING_PAYMENT"), "Belum Dibayar");
  assert.equal(mapPaymentStatus("PROCESSING", "PAID"), "Dibayar");

  assert.equal(mapShippingStatus("SHIPPED"), "Terkirim");
  assert.equal(mapShippingStatus("DELIVERED"), "Terkirim");
  assert.equal(mapShippingStatus("PROCESSING"), "Proses (Amber)");
  assert.equal(mapShippingStatus("CANCELLED"), "Dibatalkan");
});
