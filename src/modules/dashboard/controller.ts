import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as service from "./service";

export async function getOverview(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getOverview(user.id, req.query as any);
  res.json({ success: true, data });
}

export async function getCards(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getSummaryCards(user.id, req.query as any);
  res.json({ success: true, data });
}

export async function getChart(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getChartData(user.id, req.query as any);
  res.json({ success: true, data });
}

export async function getTopNeeds(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getTopNeeds(user.id, req.query as any);
  res.json({ success: true, data });
}

export async function getRecentOrders(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getRecentOrders(user.id, req.query as any);
  res.json({ success: true, data });
}

export async function getTotalSales(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getTotalSales(user.id, req.query as any)));
}

export async function getPendingOrders(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getPendingOrders(user.id)));
}

export async function getCustomerRating(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getCustomerRating(user.id)));
}

export async function getProductViews(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getProductViews(user.id, req.query as any)));
}

export async function getSalesPerformance(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getSalesPerformance(user.id, req.query as any)));
}

export async function getInventoryAlerts(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getInventoryAlerts(user.id, req.query as any)));
}

export async function getActiveOrders(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.getActiveOrders(user.id, req.query as any)));
}
