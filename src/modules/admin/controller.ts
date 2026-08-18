import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import {
  createCoupon as createCouponService,
  listAllForAdmin as listAllCoupons,
  updateCoupon as updateCouponService,
} from "../coupons/service";
import { listAll as listAllOrders } from "../orders/service";
import { listAllForAdmin as listAllPayments } from "../payments/service";
import {
  listAllForAdmin as listAllProducts,
  setActiveAsAdmin as setProductActiveAsAdmin,
} from "../products/products.service";
import {
  listAllForAdmin as listAllReviews,
  setHidden as setReviewHiddenService,
} from "../reviews/service";
import {
  listForAdmin as listAllReports,
  updateReport as updateReportService,
} from "../reports/service";
import { listForAdmin, setStatus } from "../sellers/service";
import {
  decideWithdrawal as decideWithdrawalService,
  listWithdrawals as listAllWithdrawals,
} from "../wallet/service";
import { listUsers } from "../users/users.service";
import { listAuditLogs, recordAudit } from "./audit.service";
import * as adminService from "./service";
import * as analyticsService from "./analytics.service";
import * as configService from "./config.service";
import * as profileService from "./profile.service";

export async function dashboard(_req: Request, res: Response) {
  res.json(ok(await adminService.dashboard()));
}

export async function analytics(_req: Request, res: Response) {
  res.json(ok(await analyticsService.analytics()));
}

export async function users(req: Request, res: Response) {
  const { items, meta } = await listUsers(req.query as never);
  res.json(ok(items, meta));
}

export async function stores(req: Request, res: Response) {
  const { items, meta } = await listForAdmin(req.query as never);
  res.json(ok(items, meta));
}

export async function orders(req: Request, res: Response) {
  const { items, meta } = await listAllOrders(req.query as never);
  res.json(ok(items, meta));
}

export async function products(req: Request, res: Response) {
  const { items, meta } = await listAllProducts(req.query as never);
  res.json(ok(items, meta));
}

export async function setProductActive(req: Request, res: Response) {
  const result = await setProductActiveAsAdmin(req.params.id, req.body.isActive);

  if (result.changed) {
    await recordAudit({
      actorUserId: currentUser(req).id,
      action: req.body.isActive ? "PRODUCT_ACTIVATED" : "PRODUCT_DEACTIVATED",
      targetType: "PRODUCT",
      targetId: req.params.id,
      metadata: { reason: req.body.reason ?? null },
      ip: req.ip ?? null,
    });
  }

  res.json(ok(result));
}

export async function withdrawals(req: Request, res: Response) {
  const { items, meta } = await listAllWithdrawals(req.query as never);
  res.json(ok(items, meta));
}

export async function decideWithdrawal(req: Request, res: Response) {
  const actorUserId = currentUser(req).id;
  const withdrawal = await decideWithdrawalService(
    actorUserId,
    req.params.id,
    req.body.action,
    req.body.reason
  );

  await recordAudit({
    actorUserId,
    action: req.body.action === "APPROVE" ? "WITHDRAWAL_APPROVED" : "WITHDRAWAL_REJECTED",
    targetType: "WITHDRAWAL",
    targetId: req.params.id,
    metadata: { amount: String(withdrawal.amount), reason: req.body.reason ?? null },
    ip: req.ip ?? null,
  });

  res.json(ok(withdrawal));
}

export async function reports(req: Request, res: Response) {
  const { items, meta } = await listAllReports(req.query as never);
  res.json(ok(items, meta));
}

export async function updateReport(req: Request, res: Response) {
  const actorUserId = currentUser(req).id;
  const report = await updateReportService(actorUserId, req.params.id, req.body);

  await recordAudit({
    actorUserId,
    action: "REPORT_UPDATED",
    targetType: "REPORT",
    targetId: report.id,
    metadata: { changes: req.body },
    ip: req.ip ?? null,
  });

  res.json(ok(report));
}

export async function coupons(req: Request, res: Response) {
  const { items, meta } = await listAllCoupons(req.query as never);
  res.json(ok(items, meta));
}

export async function createCoupon(req: Request, res: Response) {
  const coupon = await createCouponService(req.body);

  await recordAudit({
    actorUserId: currentUser(req).id,
    action: "COUPON_CREATED",
    targetType: "COUPON",
    targetId: coupon.id,
    metadata: { code: coupon.code, type: coupon.type, value: String(coupon.value) },
    ip: req.ip ?? null,
  });

  res.status(201).json(ok(coupon));
}

export async function updateCoupon(req: Request, res: Response) {
  const coupon = await updateCouponService(req.params.id, req.body);

  await recordAudit({
    actorUserId: currentUser(req).id,
    action: "COUPON_UPDATED",
    targetType: "COUPON",
    targetId: coupon.id,
    metadata: { changes: req.body },
    ip: req.ip ?? null,
  });

  res.json(ok(coupon));
}

export async function reviews(req: Request, res: Response) {
  const { items, meta } = await listAllReviews(req.query as never);
  res.json(ok(items, meta));
}

export async function setReviewHidden(req: Request, res: Response) {
  const result = await setReviewHiddenService(req.params.id, req.body.isHidden);

  if (result.changed) {
    await recordAudit({
      actorUserId: currentUser(req).id,
      action: req.body.isHidden ? "REVIEW_HIDDEN" : "REVIEW_UNHIDDEN",
      targetType: "REVIEW",
      targetId: req.params.id,
      metadata: { reason: req.body.reason ?? null },
      ip: req.ip ?? null,
    });
  }

  res.json(ok(result));
}

export async function payments(req: Request, res: Response) {
  const { items, meta } = await listAllPayments(req.query as never);
  res.json(ok(items, meta));
}

export async function auditLogs(req: Request, res: Response) {
  const { items, meta } = await listAuditLogs(req.query as never);
  res.json(ok(items, meta));
}

export async function setSellerStatus(req: Request, res: Response) {
  const actor = currentUser(req);
  const result = await setStatus(req.params.id, req.body.status);

  if (result.changed) {
    await recordAudit({
      actorUserId: actor.id,
      action: "SELLER_STATUS_CHANGED",
      targetType: "SELLER",
      targetId: req.params.id,
      metadata: {
        from: result.previousStatus,
        to: req.body.status,
        ...(req.body.reason ? { reason: req.body.reason } : {}),
      },
      ip: req.ip ?? null,
    });
  }

  res.json(ok({ seller: result.seller, changed: result.changed }));
}

export async function getConfigs(_req: Request, res: Response) {
  const configs = await configService.getConfigMap();
  res.json(
    ok({
      simulatedPaymentGateway: configs[configService.CONFIG_KEYS.SIMULATED_PAYMENT_GATEWAY] === "true",
      configs,
    })
  );
}

export async function getPublicSettings(_req: Request, res: Response) {
  res.json(ok(await configService.getPublicSettings()));
}

export async function setConfig(req: Request, res: Response) {
  const { key, value } = req.body;
  await configService.setConfig(key as configService.ConfigKey, value);
  res.json(ok({ success: true }));
}

export async function toggleSimulatedGateway(req: Request, res: Response) {
  const { enabled } = req.body;
  await configService.toggleSimulatedPaymentGateway(enabled);
  res.json(ok({ simulatedPaymentGateway: enabled }));
}

export async function getProfile(req: Request, res: Response) {
  const actor = currentUser(req);
  const profile = await profileService.getProfile(actor.id);
  res.json(ok(profile));
}

export async function updateProfile(req: Request, res: Response) {
  const actor = currentUser(req);
  const profile = await profileService.updateProfile(actor.id, req.body);
  res.json(ok(profile));
}

export async function uploadPhoto(req: Request, res: Response) {
  const actor = currentUser(req);
  const { photoUrl } = req.body;
  if (!photoUrl) throw new Error("photoUrl is required");
  const profile = await profileService.updatePhoto(actor.id, photoUrl);
  res.json(ok(profile));
}

export async function getPublicProfile(req: Request, res: Response) {
  const { id } = req.params;
  const profile = await profileService.getPublicProfile(id);
  res.json(ok(profile));
}
