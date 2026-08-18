import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as addressService from "./service";

export async function list(req: Request, res: Response) {
  res.json(ok(await addressService.list(currentUser(req).id)));
}

export async function create(req: Request, res: Response) {
  res.status(201).json(ok(await addressService.create(currentUser(req).id, req.body)));
}

export async function update(req: Request, res: Response) {
  res.json(ok(await addressService.update(currentUser(req).id, req.params.id, req.body)));
}

export async function remove(req: Request, res: Response) {
  res.json(ok(await addressService.remove(currentUser(req).id, req.params.id)));
}
