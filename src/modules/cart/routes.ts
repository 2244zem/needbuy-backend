import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { addItemSchema, cartItemParams, setBudgetSchema, updateItemSchema } from "./schema";

export const cartRouter = Router();

cartRouter.use(requireAuth);

cartRouter.get("/", asyncHandler(controller.get));
cartRouter.get("/count", asyncHandler(controller.getCount));
cartRouter.delete("/", writeLimiter, asyncHandler(controller.clear));

cartRouter.patch(
  "/budget",
  writeLimiter,
  validate({ body: setBudgetSchema }),
  asyncHandler(controller.setBudget)
);

cartRouter.post(
  "/items",
  writeLimiter,
  validate({ body: addItemSchema }),
  asyncHandler(controller.addItem)
);

cartRouter.patch(
  "/items/:id",
  writeLimiter,
  validate({ params: cartItemParams, body: updateItemSchema }),
  asyncHandler(controller.updateItem)
);

cartRouter.delete(
  "/items/:id",
  writeLimiter,
  validate({ params: cartItemParams }),
  asyncHandler(controller.removeItem)
);
