import { z } from "zod";

export const listNotificationsQuery = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  unreadOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;

export const notificationIdParams = z.object({ id: z.string().uuid() });
