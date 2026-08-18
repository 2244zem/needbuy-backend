import { z } from "zod";
import { money } from "../../lib/dtoPrimitives";

export const cartItemSelection = z.array(z.string().uuid()).min(1).max(100).optional();

export const checkoutSchema = z
  .object({
    addressId: z.string().uuid(),
    cartItemIds: cartItemSelection,
    shippingCost: z.number().nonnegative().max(100_000_000).default(0),
    notes: z.string().trim().max(500).optional(),
    
    couponCode: z.string().trim().min(1).max(64).optional(),
    
    paymentMethod: z.enum(["MIDTRANS", "COD", "NEEDPAY"]).default("MIDTRANS"),
  })
  .strict();

export type CheckoutInput = z.infer<typeof checkoutSchema>;

const previewLineResponse = z.object({
  cartItemId: z.string(),
  productId: z.string(),
  productName: z.string(),
  productSlug: z.string(),
  imageUrl: z.string().nullable(),
  quantity: z.number(),
  variant: z.string().nullable(),
  price: money,
  subtotal: money,
  
  bulkDiscountPercent: z.number(),
});

export const checkoutPreviewResponse = z.object({
  orderCount: z.number(),
  orders: z.array(
    z.object({
      sellerId: z.string(),
      storeName: z.string().nullable(),
      items: z.array(previewLineResponse),
      subtotal: money,
      shippingCost: money,
      total: money,
    })
  ),
  grandTotal: money,
  stockProblems: z.array(
    z.object({
      cartItemId: z.string(),
      productId: z.string(),
      productName: z.string().optional(),
      requested: z.number(),
      available: z.number(),
    })
  ),
  canCheckout: z.boolean(),
});