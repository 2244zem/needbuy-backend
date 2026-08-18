import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

const planName = z.string().trim().min(1).max(60);

export const createPlanSchema = z
  .object({
    name: planName.optional(),
    
    budget: z.number().nonnegative().max(100_000_000_000).default(0),
    needId: z.string().uuid().optional(),
    
    fromRecommendations: z.boolean().default(false),
    maxItems: z.number().int().positive().max(20).default(5),
  })
  .strict();

export const updatePlanSchema = z
  .object({
    name: planName.optional(),
    budget: z.number().nonnegative().max(100_000_000_000).optional(),
  })
  .strict()
  .refine((v) => v.name !== undefined || v.budget !== undefined, {
    message: "Isi minimal salah satu: name atau budget.",
  });

export const addPlanItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(1000).default(1),
  })
  .strict();

export const updatePlanItemSchema = z
  .object({
    quantity: z.number().int().positive().max(1000),
  })
  .strict();

export const replacePlanItemSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive().max(1000).optional(),
  })
  .strict();

export const planIdParams = z.object({ id: z.string().uuid() }).strict();
export const planItemParams = z
  .object({ id: z.string().uuid(), itemId: z.string().uuid() })
  .strict();

export const listPlansQuery = z
  .object({
    status: z.enum(["DRAFT", "READY", "NEEDS_ADJUSTMENT"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
