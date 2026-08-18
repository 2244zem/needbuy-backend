import type { Request, Response } from "express";
import { logger } from "../../config/logger";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import { createSnapForOrder } from "../payments/service";
import * as checkoutService from "./service";
import { checkoutPreviewResponse } from "./schema";

export async function preview(req: Request, res: Response) {
  const result = await checkoutService.preview(
    currentUser(req).id,
    req.body?.shippingCost ?? 0,
    req.body?.cartItemIds
  );
  res.json(ok(checkoutPreviewResponse.parse(result)));
}

export async function confirm(req: Request, res: Response) {
  const created = await checkoutService.checkout(currentUser(req).id, req.body);

  const orders = [];
  for (const item of created) {
    if (item.paymentMethod === "COD") {
      orders.push({
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        paymentMethod: "COD",
        payment: null,
      });
      continue;
    }
    try {
      orders.push({
        paymentMethod: "MIDTRANS",
        ...(await createSnapForOrder(item.orderId)),
      });
    } catch (error) {
      logger.error({ orderId: item.orderId, err: error }, "snap creation failed after checkout");
      orders.push({
        orderId: item.orderId,
        orderNumber: item.orderNumber,
        paymentMethod: "MIDTRANS",
        payment: null,
        paymentError: "SNAP_CREATION_FAILED",
      });
    }
  }

  res.status(201).json(ok({ orderCount: orders.length, orders }));
}
