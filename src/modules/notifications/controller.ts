import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as service from "./service";
import type { ListNotificationsQuery } from "./schema";

export async function list(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.list(user.id, req.query as unknown as ListNotificationsQuery)));
}

export async function unreadCount(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.unreadCount(user.id)));
}

export async function readAll(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.markAllRead(user.id)));
}

export async function readOne(req: Request, res: Response) {
  const user = currentUser(req);
  res.json(ok(await service.markRead(user.id, req.params.id)));
}
