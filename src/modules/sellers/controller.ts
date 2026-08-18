import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as sellerService from "./service";

export async function create(req: Request, res: Response) {
  const seller = await sellerService.createSeller(currentUser(req).id, req.body);
  res.status(201).json(ok(seller));
}

export async function search(req: Request, res: Response) {
  const { items, meta } = await sellerService.search(req.query as never);
  res.json(ok(items, meta));
}

export async function detail(req: Request, res: Response) {
  res.json(ok(await sellerService.getById(req.params.id)));
}

export async function getMe(req: Request, res: Response) {
  res.json(ok(await sellerService.getOwn(currentUser(req).id)));
}

export async function updateMe(req: Request, res: Response) {
  res.json(ok(await sellerService.updateOwn(currentUser(req).id, req.body)));
}

export async function follow(req: Request, res: Response) {
  res.json(ok(await sellerService.follow(currentUser(req).id, req.params.id)));
}

export async function unfollow(req: Request, res: Response) {
  res.json(ok(await sellerService.unfollow(currentUser(req).id, req.params.id)));
}
