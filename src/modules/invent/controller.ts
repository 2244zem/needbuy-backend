import type { Request, Response } from "express";
import { currentUser } from "../../middleware/auth";
import * as service from "./service";

export async function list(req: Request, res: Response) {
  const user = currentUser(req);
  const result = await service.list(user.id, req.query as any);
  res.json({ success: true, data: result.items, meta: result.meta });
}

export async function stats(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.stats(user.id);
  res.json({ success: true, data });
}

export async function detail(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.getById(user.id, req.params.id);
  res.json({ success: true, data });
}

export async function create(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.create(user.id, req.body);
  res.status(201).json({ success: true, data });
}

export async function update(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.update(user.id, req.params.id, req.body);
  res.json({ success: true, data });
}

export async function remove(req: Request, res: Response) {
  const user = currentUser(req);
  const data = await service.remove(user.id, req.params.id);
  res.json({ success: true, data });
}
