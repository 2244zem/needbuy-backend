import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";
import { isoDate, money, nullableIsoDate } from "../../lib/dtoPrimitives";

export const ORDER_STATUSES = [
  "WAITING_PAYMENT",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;

export const listOrdersQuery = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    q: z.string().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export const exportOrdersQuery = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    q: z.string().optional(),
    search: z.string().optional(),
  })
  .strict();

export const orderIdParams = z.object({ id: z.string().uuid() }).strict();

export const TRACKING_STAGES = [
  "PACKING",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "RETURNED",
  "CANCELLED",
] as const;

export const addTrackingSchema = z
  .object({
    stage: z.enum(TRACKING_STAGES),
    description: z.string().trim().min(3).max(200),
    location: z.string().trim().max(120).optional(),
  })
  .strict();

export const updateStatusSchema = z
  .object({
    status: z.enum(["SHIPPED", "DELIVERED", "COMPLETED"]),
  })
  .strict();

const orderItemResponse = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(),
  
  variant: z.string().nullable(),
  quantity: z.number(),
  price: money,
  subtotal: money,
  review: z.object({ id: z.string(), rating: z.number() }).nullable(),
});

const addressResponse = z.object({
  recipientName: z.string(),
  phone: z.string(),
  fullAddress: z.string(),
  city: z.string(),
  province: z.string(),
  postalCode: z.string(),
});

const orderBaseResponse = {
  id: z.string(),
  orderNumber: z.string(),
  status: z.string(),
  subtotal: money,
  shippingCost: money,
  total: money,
  deliveredAt: nullableIsoDate,
  completedAt: nullableIsoDate,
  createdAt: isoDate,
  address: addressResponse.nullable(),
  items: z.array(orderItemResponse),
  totalBarang: z.number(),
  statusPembayaranLabel: z.string(),
  statusPengirimanLabel: z.string(),
};

export const buyerOrderResponse = z.object({
  ...orderBaseResponse,
  seller: z.object({ id: z.string(), storeName: z.string() }),
  payment: z
    .object({
      id: z.string(),
      status: z.string(),
      method: z.string().nullable(),
      snapToken: z.string().nullable(),
      snapRedirectUrl: z.string().nullable(),
      paidAt: nullableIsoDate,
    })
    .nullable(),
});

export const buyerOrderListResponse = z.array(buyerOrderResponse);

export const sellerOrderResponse = z.object({
  ...orderBaseResponse,
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  payment: z
    .object({ id: z.string(), status: z.string(), method: z.string().nullable(), paidAt: nullableIsoDate })
    .nullable(),
});

export const sellerOrderListResponse = z.array(sellerOrderResponse);
