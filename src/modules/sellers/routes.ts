import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as orderController from "../orders/controller";
import { exportOrdersQuery, listOrdersQuery, orderIdParams } from "../orders/schema";
import * as controller from "./controller";
import { createSellerSchema, listSellersQuery, sellerIdParams, updateSellerSchema } from "./schema";

export const sellersRouter = Router();

sellersRouter.get("/", validate({ query: listSellersQuery }), asyncHandler(controller.search));

sellersRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate({ body: createSellerSchema }),
  asyncHandler(controller.create)
);

sellersRouter.get("/me", requireAuth, asyncHandler(controller.getMe));

sellersRouter.patch(
  "/me",
  requireAuth,
  writeLimiter,
  validate({ body: updateSellerSchema }),
  asyncHandler(controller.updateMe)
);

sellersRouter.get(
  "/me/orders",
  requireAuth,
  validate({ query: listOrdersQuery }),
  asyncHandler(orderController.listForSeller)
);

sellersRouter.get(
  "/me/orders/export",
  requireAuth,
  validate({ query: exportOrdersQuery }),
  asyncHandler(orderController.exportCsvForSeller)
);

sellersRouter.get(
  "/me/orders/:id",
  requireAuth,
  validate({ params: orderIdParams }),
  asyncHandler(orderController.detailForSeller)
);

sellersRouter.post(
  "/:id/follow",
  requireAuth,
  writeLimiter,
  validate({ params: sellerIdParams }),
  asyncHandler(controller.follow)
);

sellersRouter.delete(
  "/:id/follow",
  requireAuth,
  writeLimiter,
  validate({ params: sellerIdParams }),
  asyncHandler(controller.unfollow)
);

sellersRouter.get("/:id", validate({ params: sellerIdParams }), asyncHandler(controller.detail));
