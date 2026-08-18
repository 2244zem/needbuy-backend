import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { addressIdParams, createAddressSchema, updateAddressSchema } from "./schema";

export const addressesRouter = Router();

addressesRouter.use(requireAuth);

addressesRouter.get("/", asyncHandler(controller.list));

addressesRouter.post(
  "/",
  writeLimiter,
  validate({ body: createAddressSchema }),
  asyncHandler(controller.create)
);

addressesRouter.patch(
  "/:id",
  writeLimiter,
  validate({ params: addressIdParams, body: updateAddressSchema }),
  asyncHandler(controller.update)
);

addressesRouter.delete(
  "/:id",
  writeLimiter,
  validate({ params: addressIdParams }),
  asyncHandler(controller.remove)
);
