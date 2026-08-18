import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

export const saveProductSchema = z.object({ productId: z.string().uuid() }).strict();

export const savedProductParams = z.object({ productId: z.string().uuid() }).strict();

export const listSavedQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();
