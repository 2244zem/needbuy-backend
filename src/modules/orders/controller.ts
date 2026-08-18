import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import { requireOwnSeller } from "../sellers/service";
import * as orderService from "./service";
import * as trackingService from "./tracking.service";
import {
  buyerOrderListResponse,
  buyerOrderResponse,
  sellerOrderListResponse,
} from "./schema";

export async function list(req: Request, res: Response) {
  const { items, meta } = await orderService.listForUser(currentUser(req).id, req.query as never);
  res.json(ok(buyerOrderListResponse.parse(items), meta));
}

export async function detail(req: Request, res: Response) {
  res.json(ok(buyerOrderResponse.parse(await orderService.getForUser(currentUser(req).id, req.params.id))));
}

export async function tracking(req: Request, res: Response) {
  res.json(ok(await trackingService.getForOrder(currentUser(req).id, req.params.id)));
}

export async function addTracking(req: Request, res: Response) {
  const event = await trackingService.addBySeller(currentUser(req).id, req.params.id, req.body);
  res.status(201).json(ok(event));
}

export async function exportCsv(req: Request, res: Response) {
  const csvData = await orderService.exportCsvForUser(currentUser(req).id, req.query as never);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="orders.csv"');
  res.send(csvData);
}

export async function listForSeller(req: Request, res: Response) {
  const seller = await requireOwnSeller(currentUser(req).id);
  const { items, meta } = await orderService.listForSeller(seller.id, req.query as never);
  res.json(ok(sellerOrderListResponse.parse(items), meta));
}

export async function exportCsvForSeller(req: Request, res: Response) {
  const seller = await requireOwnSeller(currentUser(req).id);
  const csvData = await orderService.exportCsvForSeller(seller.id, req.query as never);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="seller-orders.csv"');
  res.send(csvData);
}

export async function detailForSeller(req: Request, res: Response) {
  const seller = await requireOwnSeller(currentUser(req).id);
  res.json(ok(await orderService.getForSeller(seller.id, req.params.id)));
}

export async function updateStatus(req: Request, res: Response) {
  const user = currentUser(req);
  const order = await orderService.transition(
    { userId: user.id, role: user.role },
    req.params.id,
    req.body.status
  );
  res.json(ok(order));
}

export async function cancel(req: Request, res: Response) {
  const user = currentUser(req);
  const order = await orderService.transition(
    { userId: user.id, role: user.role },
    req.params.id,
    "CANCELLED"
  );
  res.json(ok(order));
}
