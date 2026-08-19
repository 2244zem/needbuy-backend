import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as userService from "./users.service";

export async function getMe(req: Request, res: Response) {
  res.json(ok(await userService.getProfile(currentUser(req).id)));
}

export async function updateMe(req: Request, res: Response) {
  res.json(ok(await userService.updateProfile(currentUser(req).id, req.body)));
}

export async function changePassword(req: Request, res: Response) {
  res.json(ok(await userService.changePassword(currentUser(req).id, req.body)));
}

export async function setPassword(req: Request, res: Response) {
  res.json(ok(await userService.setPassword(currentUser(req).id, req.body.newPassword)));
}
