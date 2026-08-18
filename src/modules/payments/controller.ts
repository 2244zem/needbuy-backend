import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as paymentService from "./service";
import { paymentResponse } from "./schema";
import { handleNotification, type MidtransNotification } from "./webhook.service";

export async function webhook(req: Request, res: Response) {
  const result = await handleNotification(req.body as MidtransNotification);
  
  res.json(ok(result));
}

export async function getForOrder(req: Request, res: Response) {
  res.json(ok(paymentResponse.parse(await paymentService.getForOrder(currentUser(req).id, req.params.orderId))));
}

export async function sync(req: Request, res: Response) {
  res.json(ok(await paymentService.syncFromGateway(currentUser(req).id, req.params.orderId)));
}

export async function retry(req: Request, res: Response) {
  res.json(ok(await paymentService.retrySnap(currentUser(req).id, req.params.orderId)));
}
