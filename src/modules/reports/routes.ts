import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { createReportSchema } from "./schema";

export const reportsRouter = Router();

reportsRouter.post(
  "/",
  requireAuth,
  writeLimiter,
  validate({ body: createReportSchema }),
  asyncHandler(controller.create)
);
