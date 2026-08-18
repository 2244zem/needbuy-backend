import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";

const orderIdParams = z.object({ orderId: z.string().uuid() }).strict();

const webhookSchema = z
  .object({
    order_id: z.string().min(1).max(200),
    status_code: z.string().min(1).max(10),
    gross_amount: z.string().min(1).max(30),
    signature_key: z.string().min(1).max(200),
    transaction_status: z.string().min(1).max(50),
    transaction_id: z.string().max(200).optional(),
    payment_type: z.string().max(50).optional(),
  })
  .passthrough();

export const paymentsRouter = Router();

paymentsRouter.post(
  "/midtrans/webhook",
  validate({ body: webhookSchema }),
  asyncHandler(controller.webhook)
);

paymentsRouter.get(
  "/:orderId",
  requireAuth,
  validate({ params: orderIdParams }),
  asyncHandler(controller.getForOrder)
);

paymentsRouter.post(
  "/:orderId/sync",
  requireAuth,
  writeLimiter,
  validate({ params: orderIdParams }),
  asyncHandler(controller.sync)
);

paymentsRouter.post(
  "/:orderId/retry",
  requireAuth,
  writeLimiter,
  validate({ params: orderIdParams }),
  idempotency,
  asyncHandler(controller.retry)
);
