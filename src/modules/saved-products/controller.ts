import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as savedService from "./service";

export async function list(req: Request, res: Response) {
  const { items, meta } = await savedService.list(currentUser(req).id, req.query as never);
  res.json(ok(items, meta));
}

export async function save(req: Request, res: Response) {
  res.status(201).json(ok(await savedService.save(currentUser(req).id, req.body.productId)));
}

export async function remove(req: Request, res: Response) {
  res.json(ok(await savedService.remove(currentUser(req).id, req.params.productId)));
}
