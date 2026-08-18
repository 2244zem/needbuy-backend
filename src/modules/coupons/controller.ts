import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as couponService from "./service";

export async function list(req: Request, res: Response) {
  const { items, meta } = await couponService.list(currentUser(req).id, req.query as never);
  res.json(ok(items, meta));
}

export async function claim(req: Request, res: Response) {
  res.status(201).json(ok(await couponService.claim(currentUser(req).id, req.params.id)));
}

export async function claimByCode(req: Request, res: Response) {
  res.status(201).json(ok(await couponService.claimByCode(currentUser(req).id, req.body.code)));
}
