import crypto from "node:crypto";

export function generateOrderNumber(now: Date = new Date()): string {
  const random = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `NB-${now.getTime()}-${random}`;
}

export function generateMidtransOrderId(orderNumber: string, now: Date = new Date()): string {
  const random = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${orderNumber}-${now.getTime().toString(36).toUpperCase()}${random}`;
}

export function orderNumberFromMidtransOrderId(midtransOrderId: string): string | null {
  const parts = midtransOrderId.split("-");
  if (parts.length < 4 || parts[0] !== "NB") return null;
  return parts.slice(0, 3).join("-");
}
