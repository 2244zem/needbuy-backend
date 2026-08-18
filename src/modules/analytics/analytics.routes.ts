import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./analytics.controller";
import { analyticsQuerySchema, topProductsQuerySchema } from "./analytics.schema";

export const analyticsRouter = Router();

const sellerOnly = [requireAuth, requireRole("SELLER", "ADMIN")] as const;

analyticsRouter.get(
  "/shop/conversion",
  ...sellerOnly,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(controller.getShopConversion)
);

analyticsRouter.get(
  "/shop/top-products",
  ...sellerOnly,
  validate({ query: topProductsQuerySchema }),
  asyncHandler(controller.getShopTopProducts)
);

analyticsRouter.get(
  "/shop/insights",
  ...sellerOnly,
  validate({ query: analyticsQuerySchema }),
  asyncHandler(controller.getShopInsights)
);

analyticsRouter.get("/overview", requireAuth, validate({ query: analyticsQuerySchema }), asyncHandler(controller.getAnalyticsOverview));

analyticsRouter.get("/kpi-cards", requireAuth, validate({ query: analyticsQuerySchema }), asyncHandler(controller.getKpiCards));

analyticsRouter.get("/kpi-endpoint/query-overtime", requireAuth, validate({ query: analyticsQuerySchema }), asyncHandler(controller.getQueryOvertime));

analyticsRouter.get("/kpi-endpoint/most-requested-categories", requireAuth, validate({ query: analyticsQuerySchema }), asyncHandler(controller.getMostRequestedCategories));

analyticsRouter.get("/kpi-endpoint/match-score-distribution", requireAuth, validate({ query: analyticsQuerySchema }), asyncHandler(controller.getMatchScoreDistribution));
