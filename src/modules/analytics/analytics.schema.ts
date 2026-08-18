import { z } from "zod";

export const analyticsQuerySchema = z.object({
  period: z.enum(["day", "week", "month", "year"]).optional().default("month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const topProductsQuerySchema = analyticsQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(20).optional().default(5),
});