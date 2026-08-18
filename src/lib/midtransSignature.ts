import crypto from "node:crypto";
import { safeCompare } from "./hash";

export type PaymentStatusName = "PENDING" | "PAID" | "FAILED" | "EXPIRED" | "REFUNDED";

export function expectedSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string
): string {
  return crypto
    .createHash("sha512")
    .update(orderId + statusCode + grossAmount + serverKey)
    .digest("hex");
}

export function verifySignature(
  payload: {
    order_id: string;
    status_code: string;
    gross_amount: string;
    signature_key?: string;
  },
  serverKey: string
): boolean {
  const expected = expectedSignature(
    payload.order_id,
    payload.status_code,
    payload.gross_amount,
    serverKey
  );
  return safeCompare(expected, payload.signature_key ?? "");
}

export function mapTransactionStatus(status: string): PaymentStatusName | null {
  switch (status) {
    case "capture":
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "deny":
    case "cancel":
      return "FAILED";
    case "expire":
      return "EXPIRED";
    case "refund":
    case "partial_refund":
      return "REFUNDED";
    default:
      return null;
  }
}
