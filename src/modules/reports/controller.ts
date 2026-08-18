import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as service from "./service";

export async function create(req: Request, res: Response) {
  const report = await service.createReport(currentUser(req).id, req.body);
  res.status(201).json(ok(report));
}
