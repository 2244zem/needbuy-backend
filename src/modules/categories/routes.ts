import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  categoryIdParams,
  categorySlugParams,
  createCategorySchema,
  updateCategorySchema,
} from "./schema";

export const categoriesRouter = Router();

categoriesRouter.get("/", asyncHandler(controller.list));

const adminOnly = [requireAuth, requireRole("ADMIN"), writeLimiter] as const;

categoriesRouter.get(
  "/admin/all",
  requireAuth,
  requireRole("ADMIN"),
  asyncHandler(controller.listAdmin)
);

categoriesRouter.post(
  "/",
  ...adminOnly,
  validate({ body: createCategorySchema }),
  asyncHandler(controller.create)
);

categoriesRouter.patch(
  "/:id",
  ...adminOnly,
  validate({ params: categoryIdParams, body: updateCategorySchema }),
  asyncHandler(controller.update)
);

categoriesRouter.delete(
  "/:id",
  ...adminOnly,
  validate({ params: categoryIdParams }),
  asyncHandler(controller.remove)
);

categoriesRouter.get(
  "/:slug",
  validate({ params: categorySlugParams }),
  asyncHandler(controller.detail)
);
