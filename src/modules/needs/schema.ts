import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

export const createNeedSchema = z
  .object({
    rawInput: z
      .string()
      .trim()
      .min(5, "Ceritakan kebutuhanmu minimal 5 karakter")
      .max(2000, "Input kebutuhan maksimal 2000 karakter"),
  })
  .strict();

export const confirmNeedSchema = z
  .object({
    goal: z.string().trim().max(300).nullable().optional(),
    budget: z.number().positive().max(100_000_000_000).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    requirements: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(60),
          value: z.string().trim().min(1).max(200),
          isHard: z.boolean(),
        })
      )
      .max(30)
      .default([]),
    preferences: z
      .array(
        z.object({
          key: z.string().trim().min(1).max(60),
          value: z.string().trim().min(1).max(200),
          weight: z.number().min(0).max(5).default(1),
        })
      )
      .max(30)
      .default([]),
  })
  .strict();

export const updateNeedSchema = z
  .object({
    goal: z.string().trim().max(300).nullable().optional(),
    budget: z.number().positive().max(100_000_000_000).nullable().optional(),
    location: z.string().trim().max(120).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const addRequirementSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    value: z.string().trim().min(1).max(200),
    
    isHard: z.boolean(),
  })
  .strict();

export const addPreferenceSchema = z
  .object({
    key: z.string().trim().min(1).max(60),
    value: z.string().trim().min(1).max(200),
    weight: z.number().min(0).max(5).default(1),
  })
  .strict();

export const needIdParams = z.object({ id: z.string().uuid() }).strict();

export const requirementParams = z
  .object({ id: z.string().uuid(), reqId: z.string().uuid() })
  .strict();

export const preferenceParams = z
  .object({ id: z.string().uuid(), prefId: z.string().uuid() })
  .strict();

export const listNeedsQuery = z
  .object({
    status: z.enum(["DRAFT", "PROCESSING", "COMPLETED"]).optional(),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export const recommendationsQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export type CreateNeedInput = z.infer<typeof createNeedSchema>;
export type ConfirmNeedInput = z.infer<typeof confirmNeedSchema>;
export type UpdateNeedInput = z.infer<typeof updateNeedSchema>;
export type AddRequirementInput = z.infer<typeof addRequirementSchema>;
export type AddPreferenceInput = z.infer<typeof addPreferenceSchema>;

export const answerClarificationSchema = z
  .object({
    questionId: z.string().uuid(),
    answer: z.string().trim().min(1).max(500),
  })
  .strict();

export type AnswerClarificationInput = z.infer<typeof answerClarificationSchema>;
