import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";
import { ORDER_STATUSES } from "../orders/schema";

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export const listUsersQuery = z
  .object({
    role: z.enum(["BUYER", "SELLER", "ADMIN"]).optional(),
    q: z.string().trim().max(120).optional(),
    ...pagination,
  })
  .strict();

export const listAdminOrdersQuery = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    
    paymentStatus: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"]).optional(),
    ...pagination,
  })
  .strict();

export const listAdminProductsQuery = z
  .object({
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    categoryId: z.string().uuid().optional(),
    sellerId: z.string().uuid().optional(),
    q: z.string().trim().max(120).optional(),
    ...pagination,
  })
  .strict();

export const productIdParams = z.object({ id: z.string().uuid() }).strict();

export const setProductActiveSchema = z
  .object({
    isActive: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listAdminWithdrawalsQuery = z
  .object({
    status: z.enum(["PENDING", "SUCCESS", "FAILED"]).optional(),
    ...pagination,
  })
  .strict();

export const withdrawalIdParams = z.object({ id: z.string().uuid() }).strict();

export const decideWithdrawalSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listAdminCouponsQuery = z
  .object({
    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    ...pagination,
  })
  .strict();

export const couponIdParams = z.object({ id: z.string().uuid() }).strict();

const couponFields = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  value: z.number().nonnegative(),
  minSpend: z.number().nonnegative().optional(),
  maxDiscount: z.number().nonnegative().nullable().optional(),
  quota: z.number().int().positive().nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  isActive: z.boolean().optional(),
};

export const createCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3)
      .max(40)
      .toUpperCase()
      .regex(/^[A-Z0-9-]+$/, "Kode hanya boleh huruf, angka, dan tanda hubung"),
    type: z.enum(["PERCENT", "FIXED", "FREE_SHIPPING"]),
    category: z.enum(["SHIPPING", "CASHBACK", "DISCOUNT"]).default("DISCOUNT"),
    ...couponFields,
  })
  .strict()
  .refine((data) => data.type !== "PERCENT" || data.value <= 100, {
    message: "Diskon persen nggak boleh lebih dari 100",
    path: ["value"],
  });

export const updateCouponSchema = z
  .object(couponFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const listAdminReviewsQuery = z
  .object({
    isHidden: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    ...pagination,
  })
  .strict();

export const reviewIdParams = z.object({ id: z.string().uuid() }).strict();

export const setReviewHiddenSchema = z
  .object({
    isHidden: z.boolean(),
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const listAdminPaymentsQuery = z
  .object({
    status: z.enum(["PENDING", "PAID", "FAILED", "EXPIRED", "REFUNDED"]).optional(),
    
    method: z.enum(["MIDTRANS", "COD"]).optional(),
    ...pagination,
  })
  .strict();

export const listAuditLogsQuery = z
  .object({
    action: z.string().trim().max(60).optional(),
    targetType: z.string().trim().max(60).optional(),
    actorUserId: z.string().uuid().optional(),
    ...pagination,
  })
  .strict();

export const listStoresQuery = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    
    minRating: z.coerce.number().min(0).max(5).optional(),
    q: z.string().trim().max(120).optional(),
    ...pagination,
  })
  .strict();

export const sellerStatusParams = z.object({ id: z.string().uuid() }).strict();

export const setSellerStatusSchema = z
  .object({
    status: z.enum(["ACTIVE", "SUSPENDED"]),
    
    reason: z.string().trim().max(500).optional(),
  })
  .strict();
