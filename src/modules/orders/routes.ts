import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { idempotency } from "../../middleware/idempotency";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as reviewController from "../reviews/controller";
import { createReviewSchema, reviewTargetParams } from "../reviews/schema";
import * as controller from "./controller";
import { addTrackingSchema, exportOrdersQuery, listOrdersQuery, orderIdParams, updateStatusSchema } from "./schema";

export const ordersRouter = Router();

ordersRouter.use(requireAuth);

ordersRouter.get("/", validate({ query: listOrdersQuery }), asyncHandler(controller.list));

ordersRouter.get("/export", validate({ query: exportOrdersQuery }), asyncHandler(controller.exportCsv));

ordersRouter.get("/:id", validate({ params: orderIdParams }), asyncHandler(controller.detail));

ordersRouter.get(
  "/:id/tracking",
  validate({ params: orderIdParams }),
  asyncHandler(controller.tracking)
);

ordersRouter.post(
  "/:id/tracking",
  writeLimiter,
  validate({ params: orderIdParams, body: addTrackingSchema }),
  asyncHandler(controller.addTracking)
);

ordersRouter.patch(
  "/:id/status",
  writeLimiter,
  validate({ params: orderIdParams, body: updateStatusSchema }),
  asyncHandler(controller.updateStatus)
);

ordersRouter.post(
  "/:id/cancel",
  writeLimiter,
  validate({ params: orderIdParams }),
  idempotency,
  asyncHandler(controller.cancel)
);

ordersRouter.post(
  "/:orderId/items/:itemId/review",
  writeLimiter,
  validate({ params: reviewTargetParams, body: createReviewSchema }),
  asyncHandler(reviewController.create)
);
