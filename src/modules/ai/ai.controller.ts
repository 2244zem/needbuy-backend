import type { Request, Response } from "express";
import { AppError } from "../../lib/apiError";
import { ok } from "../../lib/response";
import * as aiService from "./ai.service";

export function interpretNeed(req: Request, res: Response) {
  res.json(ok(aiService.interpret(req.body.rawInput)));
}

export async function findSimilarNeeds(req: Request, res: Response) {
  if (!req.user) throw AppError.unauthorized();
  res.json(ok(await aiService.findSimilar(req.body, req.user.id)));
}

export function generatePlans(req: Request, res: Response) {
  res.json(ok(aiService.generatePlans(req.body)));
}

export function getInsights(req: Request, res: Response) {
  res.json(ok(aiService.getInsights(req.body)));
}

export function getMarketPulse(req: Request, res: Response) {
  res.json(ok(aiService.getMarketPulse(req.body)));
}

export function auditProduct(req: Request, res: Response) {
  res.json(ok(aiService.audit(req.body)));
}

export function checkProduct(req: Request, res: Response) {
  res.json(ok(aiService.check(req.body)));
}

export async function productQuestion(req: Request, res: Response) {
  res.json(ok(await aiService.answerProductQuestion(req.body)));
}

export async function searchFilters(req: Request, res: Response) {
  res.json(ok(await aiService.searchFilters(req.body.query)));
}
