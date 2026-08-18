import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

const reviewMediaInput = z
  .object({
    url: z.string().trim().url("URL lampiran nggak valid").max(2000),
    kind: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  })
  .strict();

export const createReviewSchema = z
  .object({
    rating: z.number().int().min(1, "Rating minimal 1").max(5, "Rating maksimal 5"),
    comment: z.string().trim().max(2000).optional(),
    media: z.array(reviewMediaInput).max(5, "Maksimal 5 foto/video per ulasan").optional(),
  })
  .strict();

export const reviewTargetParams = z
  .object({ orderId: z.string().uuid(), itemId: z.string().uuid() })
  .strict();

export const listReviewsQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();
