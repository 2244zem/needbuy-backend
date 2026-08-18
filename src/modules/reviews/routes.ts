import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { createReviewSchema, listReviewsQuery } from "./schema";

export const reviewsRouter = Router();

reviewsRouter.post(
  "/:orderId/:itemId",
  requireAuth,
  validate({ body: createReviewSchema }),
  asyncHandler(controller.create)
);

reviewsRouter.get(
  "/product/:id",
  validate({ query: listReviewsQuery }),
  asyncHandler(controller.listForProduct)
);
