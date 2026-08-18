import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { listSavedQuery, saveProductSchema, savedProductParams } from "./schema";

export const savedProductsRouter = Router();

savedProductsRouter.use(requireAuth);

savedProductsRouter.get("/", validate({ query: listSavedQuery }), asyncHandler(controller.list));

savedProductsRouter.post(
  "/",
  writeLimiter,
  validate({ body: saveProductSchema }),
  asyncHandler(controller.save)
);

savedProductsRouter.delete(
  "/:productId",
  writeLimiter,
  validate({ params: savedProductParams }),
  asyncHandler(controller.remove)
);
