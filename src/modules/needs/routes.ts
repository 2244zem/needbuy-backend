import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { analysisLimiter, writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  addPreferenceSchema,
  addRequirementSchema,
  answerClarificationSchema,
  confirmNeedSchema,
  createNeedSchema,
  listNeedsQuery,
  needIdParams,
  preferenceParams,
  recommendationsQuery,
  requirementParams,
  updateNeedSchema,
} from "./schema";

const processSchema = z.object({ categoryId: z.string().uuid().optional() }).strict();

export const needsRouter = Router();

needsRouter.use(requireAuth);

needsRouter.get("/", validate({ query: listNeedsQuery }), asyncHandler(controller.list));

needsRouter.post(
  "/",
  analysisLimiter,
  validate({ body: createNeedSchema }),
  asyncHandler(controller.create)
);

needsRouter.get("/:id", validate({ params: needIdParams }), asyncHandler(controller.detail));

needsRouter.patch(
  "/:id",
  writeLimiter,
  validate({ params: needIdParams, body: updateNeedSchema }),
  asyncHandler(controller.update)
);

needsRouter.delete(
  "/:id",
  writeLimiter,
  validate({ params: needIdParams }),
  asyncHandler(controller.remove)
);

needsRouter.post(
  "/:id/confirm",
  writeLimiter,
  validate({ params: needIdParams, body: confirmNeedSchema }),
  asyncHandler(controller.confirm)
);

needsRouter.post(
  "/:id/process",
  analysisLimiter,
  validate({ params: needIdParams, body: processSchema }),
  asyncHandler(controller.process)
);

needsRouter.post(
  "/:id/requirements",
  writeLimiter,
  validate({ params: needIdParams, body: addRequirementSchema }),
  asyncHandler(controller.addRequirement)
);

needsRouter.delete(
  "/:id/requirements/:reqId",
  writeLimiter,
  validate({ params: requirementParams }),
  asyncHandler(controller.removeRequirement)
);

needsRouter.post(
  "/:id/preferences",
  writeLimiter,
  validate({ params: needIdParams, body: addPreferenceSchema }),
  asyncHandler(controller.addPreference)
);

needsRouter.delete(
  "/:id/preferences/:prefId",
  writeLimiter,
  validate({ params: preferenceParams }),
  asyncHandler(controller.removePreference)
);

needsRouter.get(
  "/:id/recommendations",
  validate({ params: needIdParams, query: recommendationsQuery }),
  asyncHandler(controller.recommendations)
);

needsRouter.get(
  "/:id/clarifications",
  validate({ params: needIdParams }),
  asyncHandler(controller.clarifications)
);

needsRouter.post(
  "/:id/clarify",
  analysisLimiter,
  validate({ params: needIdParams, body: answerClarificationSchema }),
  asyncHandler(controller.clarify)
);
