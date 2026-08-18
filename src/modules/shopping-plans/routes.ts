import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  addPlanItemSchema,
  createPlanSchema,
  listPlansQuery,
  planIdParams,
  planItemParams,
  replacePlanItemSchema,
  updatePlanItemSchema,
  updatePlanSchema,
} from "./schema";

export const shoppingPlansRouter = Router();

shoppingPlansRouter.use(requireAuth);

shoppingPlansRouter.get("/", validate({ query: listPlansQuery }), asyncHandler(controller.list));

shoppingPlansRouter.post(
  "/",
  writeLimiter,
  validate({ body: createPlanSchema }),
  asyncHandler(controller.create)
);

shoppingPlansRouter.get(
  "/:id",
  validate({ params: planIdParams }),
  asyncHandler(controller.detail)
);

shoppingPlansRouter.patch(
  "/:id",
  writeLimiter,
  validate({ params: planIdParams, body: updatePlanSchema }),
  asyncHandler(controller.update)
);

shoppingPlansRouter.get(
  "/:id/alternatives",
  validate({ params: planIdParams }),
  asyncHandler(controller.alternatives)
);

shoppingPlansRouter.post(
  "/:id/add-to-cart",
  writeLimiter,
  validate({ params: planIdParams }),
  asyncHandler(controller.addAllToCart)
);

shoppingPlansRouter.post(
  "/:id/items",
  writeLimiter,
  validate({ params: planIdParams, body: addPlanItemSchema }),
  asyncHandler(controller.addItem)
);

shoppingPlansRouter.patch(
  "/:id/items/:itemId",
  writeLimiter,
  validate({ params: planItemParams, body: updatePlanItemSchema }),
  asyncHandler(controller.updateItem)
);

shoppingPlansRouter.put(
  "/:id/items/:itemId/replace",
  writeLimiter,
  validate({ params: planItemParams, body: replacePlanItemSchema }),
  asyncHandler(controller.replaceItem)
);

shoppingPlansRouter.delete(
  "/:id/items/:itemId",
  writeLimiter,
  validate({ params: planItemParams }),
  asyncHandler(controller.removeItem)
);
