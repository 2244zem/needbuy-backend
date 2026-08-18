import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as planService from "./service";

export async function create(req: Request, res: Response) {
  res.status(201).json(ok(await planService.createPlan(currentUser(req).id, req.body)));
}

export async function list(req: Request, res: Response) {
  const { items, meta } = await planService.listPlans(currentUser(req).id, req.query as never);
  res.json(ok(items, meta));
}

export async function detail(req: Request, res: Response) {
  res.json(ok(await planService.getPlan(currentUser(req).id, req.params.id)));
}

export async function update(req: Request, res: Response) {
  res.json(ok(await planService.updatePlan(currentUser(req).id, req.params.id, req.body)));
}

export async function addItem(req: Request, res: Response) {
  const plan = await planService.addItem(
    currentUser(req).id,
    req.params.id,
    req.body.productId,
    req.body.quantity
  );
  res.status(201).json(ok(plan));
}

export async function updateItem(req: Request, res: Response) {
  const plan = await planService.updateItem(
    currentUser(req).id,
    req.params.id,
    req.params.itemId,
    req.body.quantity
  );
  res.json(ok(plan));
}

export async function replaceItem(req: Request, res: Response) {
  const plan = await planService.replaceItem(
    currentUser(req).id,
    req.params.id,
    req.params.itemId,
    req.body.productId,
    req.body.quantity
  );
  res.json(ok(plan));
}

export async function removeItem(req: Request, res: Response) {
  const plan = await planService.removeItem(currentUser(req).id, req.params.id, req.params.itemId);
  res.json(ok(plan));
}

export async function alternatives(req: Request, res: Response) {
  res.json(ok(await planService.alternatives(currentUser(req).id, req.params.id)));
}

export async function addAllToCart(req: Request, res: Response) {
  res.json(ok(await planService.addAllToCart(currentUser(req).id, req.params.id)));
}
