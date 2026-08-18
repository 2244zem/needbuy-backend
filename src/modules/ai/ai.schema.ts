import { z } from "zod";

const attributeSchema = z.object({
  key: z.string().max(100).optional(),
  attr_key: z.string().max(100).optional(),
  attrKey: z.string().max(100).optional(),
  value: z.string().max(500).optional(),
  attr_value: z.string().max(500).optional(),
  attrValue: z.string().max(500).optional(),
});

const requirementSchema = z.object({
  key: z.string().max(100),
  value: z.string().max(500),
  is_hard_requirement: z.boolean().optional(),
  isHard: z.boolean().optional(),
});

const preferenceSchema = z.object({
  key: z.string().max(100),
  value: z.string().max(500),
  weight: z.number().optional(),
});

export const interpretSchema = z
  .object({ rawInput: z.string().min(1).max(1000) })
  .strict();

export const similarSchema = z
  .object({
    needId: z.string().uuid(),
    limit: z.number().int().positive().max(50).optional().default(5),
  })
  .strict();

export const plansSchema = z
  .object({
    need_id: z.string().uuid(),
    budget: z.number().int().nonnegative(),
    requirements: z.array(requirementSchema).optional(),
    preferences: z.array(preferenceSchema).optional(),
    products: z
      .array(
        z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          price: z.number().optional(),
          rating: z.number().nullable().optional(),
        })
      )
      .optional(),
  })
  .strict();

export const insightsSchema = z
  .object({
    need_goal: z.string().max(500).optional(),
    budget: z.number().int().nonnegative().optional(),
    product_count: z.number().int().nonnegative().optional(),
  })
  .strict();

export const marketPulseSchema = z
  .object({
    product_ids: z.array(z.string()).optional(),
    products_data: z
      .array(
        z.object({
          price: z.number().optional(),
          stock: z.number().optional(),
        })
      )
      .optional(),
  })
  .strict();

export const auditProductSchema = z
  .object({
    product: z.object({
      name: z.string().max(300).optional(),
      description: z.string().max(10000).optional(),
      sku: z.string().max(100).optional(),
      category: z.string().max(160).optional(),
      category_name: z.string().max(160).optional(),
      price: z.union([z.number(), z.string(), z.null()]).optional(),
      attributes: z.array(attributeSchema).optional(),
      specs: z.array(attributeSchema).optional(),
    }),
  })
  .strict();

export const checkProductSchema = z
  .object({
    product: z.object({
      name: z.string().max(300).optional(),
      attributes: z.array(attributeSchema).optional(),
      specs: z.array(attributeSchema).optional(),
    }),
    requirements: z.array(requirementSchema).optional(),
    preferences: z.array(preferenceSchema).optional(),
  })
  .strict();

export type InterpretInput = z.infer<typeof interpretSchema>;
export type SimilarInput = z.infer<typeof similarSchema>;
export type PlansInput = z.infer<typeof plansSchema>;
export type InsightsInput = z.infer<typeof insightsSchema>;
export type MarketPulseInput = z.infer<typeof marketPulseSchema>;
export type AuditProductInput = z.infer<typeof auditProductSchema>;
export type CheckProductInput = z.infer<typeof checkProductSchema>;

export type IncomingAttribute = z.infer<typeof attributeSchema>;
export type IncomingRequirement = z.infer<typeof requirementSchema>;
export const productQuestionSchema = z
  .object({
    productId: z.string().uuid(),
    question: z.string().trim().min(1).max(300),
  })
  .strict();

export type ProductQuestionInput = z.infer<typeof productQuestionSchema>;
