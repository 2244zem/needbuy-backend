import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { cartItemSelection, checkoutSchema } from "./schema";

const previewSchema = z
  .object({
    shippingCost: z.number().nonnegative().max(100_000_000).default(0),
    cartItemIds: cartItemSelection,
  })
  .strict();

export const checkoutRouter = Router();

checkoutRouter.use(requireAuth);

checkoutRouter.post(
  "/preview",
  validate({ body: previewSchema }),
  asyncHandler(controller.preview)
);

checkoutRouter.post(
  "/",
  writeLimiter,
  validate({ body: checkoutSchema }),
  idempotency,
  asyncHandler(controller.confirm)
);
