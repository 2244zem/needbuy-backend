import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

export const listCouponsQuery = z
  .object({
    scope: z.enum(["available", "mine"]).default("available"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export const couponIdParams = z.object({ id: z.string().uuid() }).strict();

export const claimByCodeSchema = z
  .object({ code: z.string().trim().min(3).max(40).toUpperCase() })
  .strict();

export type ListCouponsQuery = z.infer<typeof listCouponsQuery>;
