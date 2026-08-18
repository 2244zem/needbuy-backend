import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as service from "./analytics.service";

export async function getAnalyticsOverview(req: Request, res: Response) {
  const data = await service.getAnalyticsOverview(req.query as any);
  res.json({ success: true, data });
}

export async function getKpiCards(req: Request, res: Response) {
  const data = await service.getKpiCards(req.query as any);
  res.json({ success: true, data });
}

export async function getQueryOvertime(req: Request, res: Response) {
  const data = await service.getQueryOvertime(req.query as any);
  res.json({ success: true, data });
}

export async function getMostRequestedCategories(req: Request, res: Response) {
  const data = await service.getMostRequestedCategories(req.query as any);
  res.json({ success: true, data });
}

export async function getMatchScoreDistribution(req: Request, res: Response) {
  const data = await service.getMatchScoreDistribution(req.query as any);
  res.json({ success: true, data });
}

export async function getShopConversion(req: Request, res: Response) {
  const data = await service.getShopConversion(currentUser(req).id, req.query as any);
  res.json(ok(data));
}

export async function getShopTopProducts(req: Request, res: Response) {
  const { limit, ...query } = req.query as any;
  const data = await service.getShopTopProducts(currentUser(req).id, query, limit ? Number(limit) : 5);
  res.json(ok(data));
}

export async function getShopInsights(req: Request, res: Response) {
  const data = await service.getShopInsights(currentUser(req).id, req.query as any);
  res.json(ok(data));
}
