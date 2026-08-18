import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import { listForNeed } from "../recommendations/ranking.service";
import * as needService from "./service";

export async function create(req: Request, res: Response) {
  const result = await needService.createNeed(currentUser(req).id, req.body.rawInput);
  res.status(201).json(ok(result));
}

export async function confirm(req: Request, res: Response) {
  const result = await needService.confirmNeed(currentUser(req).id, req.params.id, req.body);
  res.json(ok(result));
}

export async function process(req: Request, res: Response) {
  const result = await needService.processNeed(
    currentUser(req).id,
    req.params.id,
    req.body?.categoryId
  );
  res.json(ok(result));
}

export async function list(req: Request, res: Response) {
  const { items, meta } = await needService.listNeeds(currentUser(req).id, req.query as never);
  res.json(ok(items, meta));
}

export async function detail(req: Request, res: Response) {
  res.json(ok(await needService.getNeed(currentUser(req).id, req.params.id)));
}

export async function update(req: Request, res: Response) {
  res.json(ok(await needService.updateNeed(currentUser(req).id, req.params.id, req.body)));
}

export async function remove(req: Request, res: Response) {
  res.json(ok(await needService.deleteNeed(currentUser(req).id, req.params.id)));
}

export async function addRequirement(req: Request, res: Response) {
  const created = await needService.addRequirement(currentUser(req).id, req.params.id, req.body);
  res.status(201).json(ok(created));
}

export async function removeRequirement(req: Request, res: Response) {
  const result = await needService.removeRequirement(
    currentUser(req).id,
    req.params.id,
    req.params.reqId
  );
  res.json(ok(result));
}

export async function addPreference(req: Request, res: Response) {
  const created = await needService.addPreference(currentUser(req).id, req.params.id, req.body);
  res.status(201).json(ok(created));
}

export async function removePreference(req: Request, res: Response) {
  const result = await needService.removePreference(
    currentUser(req).id,
    req.params.id,
    req.params.prefId
  );
  res.json(ok(result));
}

export async function recommendations(req: Request, res: Response) {
  await needService.requireOwnNeed(currentUser(req).id, req.params.id);
  const { items, meta } = await listForNeed(req.params.id, req.query as never);
  res.json(ok(items, meta));
}

export async function clarifications(req: Request, res: Response) {
  res.json(ok(await needService.listClarifications(currentUser(req).id, req.params.id)));
}

export async function clarify(req: Request, res: Response) {
  const result = await needService.answerClarification(
    currentUser(req).id,
    req.params.id,
    req.body
  );
  res.json(ok(result));
}
