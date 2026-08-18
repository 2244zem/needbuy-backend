import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { claimByCodeSchema, couponIdParams, listCouponsQuery } from "./schema";

export const couponsRouter = Router();

couponsRouter.use(requireAuth);

couponsRouter.get("/", validate({ query: listCouponsQuery }), asyncHandler(controller.list));

couponsRouter.post(
  "/claim",
  writeLimiter,
  validate({ body: claimByCodeSchema }),
  asyncHandler(controller.claimByCode)
);

couponsRouter.post(
  "/:id/claim",
  writeLimiter,
  validate({ params: couponIdParams }),
  asyncHandler(controller.claim)
);
