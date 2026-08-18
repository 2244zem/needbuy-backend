import { z } from "zod";

export const dashboardQuerySchema = z.object({
  period: z.enum(["day", "week", "month", "year"]).optional().default("month"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export const topNeedsQuerySchema = dashboardQuerySchema.extend({
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});

export type TopNeedsQuery = z.infer<typeof topNeedsQuerySchema>;

export const recentOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
  status: z.string().optional(),
});

export type RecentOrdersQuery = z.infer<typeof recentOrdersQuerySchema>;

export const inventoryAlertsQuerySchema = z.object({
  threshold: z.coerce.number().int().min(0).max(1000).optional().default(5),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type InventoryAlertsQuery = z.infer<typeof inventoryAlertsQuerySchema>;

export const activeOrdersQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

export type ActiveOrdersQuery = z.infer<typeof activeOrdersQuerySchema>;
