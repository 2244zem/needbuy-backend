export type OrderStatusName =
  | "WAITING_PAYMENT"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED";

export const TRANSITIONS: Record<OrderStatusName, OrderStatusName[]> = {
  WAITING_PAYMENT: ["PROCESSING", "CANCELLED"],
  
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatusName, to: OrderStatusName): boolean {
  return TRANSITIONS[from].includes(to);
}
