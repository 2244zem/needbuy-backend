import assert from "node:assert/strict";
import { test } from "node:test";
import { canTransition, TRANSITIONS, type OrderStatusName } from "./orderStatus";

const ALL: OrderStatusName[] = [
  "WAITING_PAYMENT",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

test("jalur bahagia lifecycle order", () => {
  assert.ok(canTransition("WAITING_PAYMENT", "PROCESSING"));
  assert.ok(canTransition("PROCESSING", "SHIPPED"));
  assert.ok(canTransition("SHIPPED", "DELIVERED"));
  assert.ok(canTransition("DELIVERED", "COMPLETED"));
});

test("CANCELLED dari WAITING_PAYMENT dan PROCESSING", () => {
  assert.ok(canTransition("WAITING_PAYMENT", "CANCELLED"));

  assert.equal(canTransition("PROCESSING", "CANCELLED"), true);
  assert.equal(canTransition("SHIPPED", "CANCELLED"), false);
  assert.equal(canTransition("DELIVERED", "CANCELLED"), false);
});

test("status terminal tidak punya jalan keluar", () => {
  for (const to of ALL) {
    assert.equal(canTransition("COMPLETED", to), false, `COMPLETED -> ${to}`);
    assert.equal(canTransition("CANCELLED", to), false, `CANCELLED -> ${to}`);
  }
});

test("tidak ada lompatan status", () => {
  assert.equal(canTransition("WAITING_PAYMENT", "COMPLETED"), false);
  assert.equal(canTransition("WAITING_PAYMENT", "SHIPPED"), false);
  assert.equal(canTransition("PROCESSING", "DELIVERED"), false);
  assert.equal(canTransition("PROCESSING", "COMPLETED"), false);
});

test("tidak ada transisi mundur", () => {
  assert.equal(canTransition("SHIPPED", "PROCESSING"), false);
  assert.equal(canTransition("DELIVERED", "SHIPPED"), false);
  assert.equal(canTransition("PROCESSING", "WAITING_PAYMENT"), false);
});

test("peta transisi mencakup semua status", () => {
  assert.deepEqual(Object.keys(TRANSITIONS).sort(), [...ALL].sort());
});
