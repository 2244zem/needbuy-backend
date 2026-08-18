import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  activeOrdersQuerySchema,
  dashboardQuerySchema,
  inventoryAlertsQuerySchema,
  recentOrdersQuerySchema,
  topNeedsQuerySchema,
} from "./schema";

export const dashboardRouter = Router();

const sellerOnly = [requireAuth, requireRole("SELLER", "ADMIN")] as const;

dashboardRouter.get("/overview", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getOverview));

dashboardRouter.get("/cards", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getCards));

dashboardRouter.get("/chart", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getChart));

dashboardRouter.get("/top-needs", ...sellerOnly, validate({ query: topNeedsQuerySchema }), asyncHandler(controller.getTopNeeds));

dashboardRouter.get("/recent-orders", ...sellerOnly, validate({ query: recentOrdersQuerySchema }), asyncHandler(controller.getRecentOrders));

dashboardRouter.get("/total-sales", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getTotalSales));

dashboardRouter.get("/pending-orders", ...sellerOnly, asyncHandler(controller.getPendingOrders));

dashboardRouter.get("/customer-rating", ...sellerOnly, asyncHandler(controller.getCustomerRating));

dashboardRouter.get("/product-views", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getProductViews));

dashboardRouter.get("/sales-performance", ...sellerOnly, validate({ query: dashboardQuerySchema }), asyncHandler(controller.getSalesPerformance));

dashboardRouter.get("/inventory-alerts", ...sellerOnly, validate({ query: inventoryAlertsQuerySchema }), asyncHandler(controller.getInventoryAlerts));

dashboardRouter.get("/active-orders", ...sellerOnly, validate({ query: activeOrdersQuerySchema }), asyncHandler(controller.getActiveOrders));
