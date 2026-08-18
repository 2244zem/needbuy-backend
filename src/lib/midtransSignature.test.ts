import assert from "node:assert/strict";
import { test } from "node:test";
import { expectedSignature, mapTransactionStatus, verifySignature } from "./midtransSignature";

const SERVER_KEY = "SB-Mid-server-testkey1234567890";
const base = { order_id: "NB-1-ABC", status_code: "200", gross_amount: "150000.00" };

function signed() {
  return {
    ...base,
    signature_key: expectedSignature(
      base.order_id,
      base.status_code,
      base.gross_amount,
      SERVER_KEY
    ),
  };
}

test("signature yang benar diterima", () => {
  assert.equal(verifySignature(signed(), SERVER_KEY), true);
});

test("signature yang dirusak ditolak", () => {
  const payload = signed();
  const tampered = { ...payload, signature_key: payload.signature_key.replace(/.$/, "0") };
  assert.equal(verifySignature(tampered, SERVER_KEY), false);
});

test("gross_amount yang diubah membatalkan signature", () => {
  const payload = { ...signed(), gross_amount: "1.00" };
  assert.equal(verifySignature(payload, SERVER_KEY), false);
});

test("order_id yang diubah membatalkan signature", () => {
  const payload = { ...signed(), order_id: "NB-2-XYZ" };
  assert.equal(verifySignature(payload, SERVER_KEY), false);
});

test("server key yang salah menolak signature yang sah", () => {
  assert.equal(verifySignature(signed(), "SB-Mid-server-keylain0000000000"), false);
});

test("signature kosong atau hilang ditolak", () => {
  assert.equal(verifySignature({ ...base, signature_key: "" }, SERVER_KEY), false);
  assert.equal(verifySignature(base, SERVER_KEY), false);
});

test("pemetaan transaction_status lengkap sesuai CLAUDE.md §6.3", () => {
  assert.equal(mapTransactionStatus("capture"), "PAID");
  assert.equal(mapTransactionStatus("settlement"), "PAID");
  assert.equal(mapTransactionStatus("pending"), "PENDING");
  assert.equal(mapTransactionStatus("deny"), "FAILED");
  assert.equal(mapTransactionStatus("cancel"), "FAILED");
  assert.equal(mapTransactionStatus("expire"), "EXPIRED");
  assert.equal(mapTransactionStatus("refund"), "REFUNDED");
  assert.equal(mapTransactionStatus("partial_refund"), "REFUNDED");
});

test("transaction_status tak dikenal mengembalikan null, bukan menebak", () => {
  assert.equal(mapTransactionStatus("authorize"), null);
  assert.equal(mapTransactionStatus(""), null);
});
