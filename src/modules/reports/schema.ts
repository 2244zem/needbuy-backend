import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

const pagination = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export const reportTargetType = z.enum(["PRODUCT", "SELLER", "REVIEW"]);
export const reportPriority = z.enum(["LOW", "MEDIUM", "HIGH"]);
export const reportStatus = z.enum(["OPEN", "INVESTIGATING", "RESOLVED"]);

export const createReportSchema = z
  .object({
    targetType: reportTargetType,
    targetId: z.string().uuid(),
    reason: z.string().trim().min(4).max(120),
    description: z.string().trim().max(1000).optional(),
  })
  .strict();

export const listReportsQuery = z
  .object({
    status: reportStatus.optional(),
    priority: reportPriority.optional(),
    targetType: reportTargetType.optional(),
    ...pagination,
  })
  .strict();

export const reportIdParams = z.object({ id: z.string().uuid() }).strict();

export const updateReportSchema = z
  .object({
    status: reportStatus.optional(),
    priority: reportPriority.optional(),
    resolution: z.string().trim().max(1000).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: "Nggak ada yang diubah.",
  });

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuery>;
export type UpdateReportInput = z.infer<typeof updateReportSchema>;
