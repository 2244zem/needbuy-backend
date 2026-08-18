import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { analysisLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./ai.controller";
import {
  auditProductSchema,
  checkProductSchema,
  insightsSchema,
  interpretSchema,
  marketPulseSchema,
  plansSchema,
  productQuestionSchema,
  similarSchema,
} from "./ai.schema";

export const aiRouter = Router();
aiRouter.use(analysisLimiter);

aiRouter.post(
  "/needs/interpret",
  validate({ body: interpretSchema }),
  asyncHandler(async (req, res) => controller.interpretNeed(req, res))
);

aiRouter.post(
  "/needs/similar",
  requireAuth,
  validate({ body: similarSchema }),
  asyncHandler(controller.findSimilarNeeds)
);

aiRouter.post(
  "/plans/generate",
  validate({ body: plansSchema }),
  asyncHandler(async (req, res) => controller.generatePlans(req, res))
);

aiRouter.post(
  "/insights",
  validate({ body: insightsSchema }),
  asyncHandler(async (req, res) => controller.getInsights(req, res))
);

aiRouter.post(
  "/market/pulse",
  validate({ body: marketPulseSchema }),
  asyncHandler(async (req, res) => controller.getMarketPulse(req, res))
);

aiRouter.post(
  "/products/audit",
  validate({ body: auditProductSchema }),
  asyncHandler(async (req, res) => controller.auditProduct(req, res))
);

aiRouter.post(
  "/products/check",
  validate({ body: checkProductSchema }),
  asyncHandler(async (req, res) => controller.checkProduct(req, res))
);

aiRouter.post(
  "/products/ask",
  validate({ body: productQuestionSchema }),
  asyncHandler(controller.productQuestion)
);
