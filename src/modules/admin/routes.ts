import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth, requireRole } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  decideWithdrawalSchema,
  listAdminWithdrawalsQuery,
  withdrawalIdParams,
  couponIdParams,
  createCouponSchema,
  listAdminCouponsQuery,
  listAdminOrdersQuery,
  listAdminPaymentsQuery,
  listAdminProductsQuery,
  listAdminReviewsQuery,
  listAuditLogsQuery,
  listStoresQuery,
  listUsersQuery,
  productIdParams,
  reviewIdParams,
  sellerStatusParams,
  setReviewHiddenSchema,
  setProductActiveSchema,
  setSellerStatusSchema,
  updateCouponSchema,
} from "./schema";
import { listReportsQuery, reportIdParams, updateReportSchema } from "../reports/schema";
import { setConfigSchema } from "./config.schema";
import { profileIdParams, updateProfileSchema } from "./profile.schema";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/dashboard", asyncHandler(controller.dashboard));

adminRouter.get("/analytics", asyncHandler(controller.analytics));

adminRouter.get("/users", validate({ query: listUsersQuery }), asyncHandler(controller.users));

adminRouter.get("/stores", validate({ query: listStoresQuery }), asyncHandler(controller.stores));

adminRouter.get(
  "/orders",
  validate({ query: listAdminOrdersQuery }),
  asyncHandler(controller.orders)
);

adminRouter.get(
  "/products",
  validate({ query: listAdminProductsQuery }),
  asyncHandler(controller.products)
);

adminRouter.patch(
  "/products/:id/active",
  writeLimiter,
  validate({ params: productIdParams, body: setProductActiveSchema }),
  asyncHandler(controller.setProductActive)
);

adminRouter.get(
  "/withdrawals",
  validate({ query: listAdminWithdrawalsQuery }),
  asyncHandler(controller.withdrawals)
);

adminRouter.patch(
  "/withdrawals/:id",
  writeLimiter,
  validate({ params: withdrawalIdParams, body: decideWithdrawalSchema }),
  asyncHandler(controller.decideWithdrawal)
);

adminRouter.get(
  "/reports",
  validate({ query: listReportsQuery }),
  asyncHandler(controller.reports)
);

adminRouter.patch(
  "/reports/:id",
  writeLimiter,
  validate({ params: reportIdParams, body: updateReportSchema }),
  asyncHandler(controller.updateReport)
);

adminRouter.get(
  "/coupons",
  validate({ query: listAdminCouponsQuery }),
  asyncHandler(controller.coupons)
);

adminRouter.post(
  "/coupons",
  writeLimiter,
  validate({ body: createCouponSchema }),
  asyncHandler(controller.createCoupon)
);

adminRouter.patch(
  "/coupons/:id",
  writeLimiter,
  validate({ params: couponIdParams, body: updateCouponSchema }),
  asyncHandler(controller.updateCoupon)
);

adminRouter.get(
  "/reviews",
  validate({ query: listAdminReviewsQuery }),
  asyncHandler(controller.reviews)
);

adminRouter.patch(
  "/reviews/:id/hidden",
  writeLimiter,
  validate({ params: reviewIdParams, body: setReviewHiddenSchema }),
  asyncHandler(controller.setReviewHidden)
);

adminRouter.get(
  "/payments",
  validate({ query: listAdminPaymentsQuery }),
  asyncHandler(controller.payments)
);

adminRouter.get(
  "/audit-logs",
  validate({ query: listAuditLogsQuery }),
  asyncHandler(controller.auditLogs)
);

adminRouter.patch(
  "/sellers/:id/status",
  writeLimiter,
  validate({ params: sellerStatusParams, body: setSellerStatusSchema }),
  asyncHandler(controller.setSellerStatus)
);

adminRouter.get("/configs", asyncHandler(controller.getConfigs));

adminRouter.post(
  "/configs",
  writeLimiter,
  validate({ body: setConfigSchema }),
  asyncHandler(controller.setConfig)
);

adminRouter.post(
  "/configs/simulated-gateway",
  writeLimiter,
  asyncHandler(controller.toggleSimulatedGateway)
);

adminRouter.get("/profile", asyncHandler(controller.getProfile));

adminRouter.patch(
  "/profile",
  writeLimiter,
  validate({ body: updateProfileSchema }),
  asyncHandler(controller.updateProfile)
);

adminRouter.post(
  "/profile/photo",
  writeLimiter,
  asyncHandler(controller.uploadPhoto)
);
