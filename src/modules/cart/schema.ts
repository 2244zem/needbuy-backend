import { z } from "zod";
import { isoDate, money, nullableMoney } from "../../lib/dtoPrimitives";

export const addItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(1000).default(1),
    
    variant: z.string().trim().max(200).nullable().optional(),
  })
  .strict();

export const updateItemSchema = z
  .object({
    quantity: z.number().int().positive().max(1000),
  })
  .strict();

export const cartItemParams = z.object({ id: z.string().uuid() }).strict();

export const setBudgetSchema = z
  .object({
    budget: z.number().nonnegative().max(100_000_000_000).nullable(),
  })
  .strict();

export const cartItemResponse = z.object({
  id: z.string(),
  quantity: z.number(),
  variant: z.string().nullable(),
  priceAtAdd: money,
  subtotal: money,
  
  bulkDiscountPercent: z.number(),
  createdAt: isoDate,
  product: z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    price: money,
    stock: z.number(),
    isActive: z.boolean(),
    bulkMinQty: z.number().nullable(),
    bulkDiscountPercent: z.number().nullable(),
    seller: z.object({ id: z.string(), storeName: z.string() }),
    images: z.array(z.object({ url: z.string() })),
  }),
});

export const cartResponse = z.object({
  id: z.string(),
  budget: nullableMoney,
  items: z.array(cartItemResponse),
  itemCount: z.number(),
  subtotal: money,
  budgetCheck: z
    .object({
      overBudget: z.boolean(),
      remaining: money,
      budgetPercentage: z.number(),
    })
    .nullable(),
  unavailableItems: z.array(
    z.object({
      cartItemId: z.string(),
      productId: z.string(),
      requested: z.number(),
      available: z.number(),
    })
  ),
});

export type CartResponse = z.infer<typeof cartResponse>;
