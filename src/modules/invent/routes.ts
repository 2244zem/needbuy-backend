import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { createInventSchema, inventIdParams, listInventQuery, updateInventSchema } from "./schema";

export const inventRouter = Router();

const sellerOnly = [requireAuth, requireRole("SELLER", "ADMIN")] as const;
const sellerWrite = [...sellerOnly, writeLimiter] as const;

inventRouter.get("/", ...sellerOnly, validate({ query: listInventQuery }), asyncHandler(controller.list));
inventRouter.post("/", ...sellerWrite, validate({ body: createInventSchema }), asyncHandler(controller.create));

inventRouter.get("/stats", ...sellerOnly, asyncHandler(controller.stats));

inventRouter.get("/:id", ...sellerOnly, validate({ params: inventIdParams }), asyncHandler(controller.detail));
inventRouter.patch(
  "/:id",
  ...sellerWrite,
  validate({ params: inventIdParams, body: updateInventSchema }),
  asyncHandler(controller.update)
);
inventRouter.delete("/:id", ...sellerWrite, validate({ params: inventIdParams }), asyncHandler(controller.remove));