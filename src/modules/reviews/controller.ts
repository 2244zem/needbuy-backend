import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as reviewService from "./service";

export async function create(req: Request, res: Response) {
  const review = await reviewService.createReview(
    currentUser(req).id,
    req.params.orderId,
    req.params.itemId,
    req.body
  );
  res.status(201).json(ok(review));
}

export async function listForProduct(req: Request, res: Response) {
  const { items, meta } = await reviewService.listForProduct(req.params.id, req.query as never);
  res.json(ok(items, meta));
}
