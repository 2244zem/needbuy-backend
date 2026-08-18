import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import { recordAudit } from "../admin/audit.service";
import * as categoryService from "./service";

export async function list(_req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json(ok(await categoryService.listTree()));
}

export async function listAdmin(_req: Request, res: Response) {
  res.json(ok(await categoryService.listAllForAdmin()));
}

export async function detail(req: Request, res: Response) {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json(ok(await categoryService.getBySlug(req.params.slug)));
}

export async function create(req: Request, res: Response) {
  const category = await categoryService.createCategory(req.body);

  await recordAudit({
    actorUserId: currentUser(req).id,
    action: "CATEGORY_CREATED",
    targetType: "CATEGORY",
    targetId: category.id,
    metadata: { name: category.name, slug: category.slug, parentId: category.parentId },
    ip: req.ip ?? null,
  });

  res.status(201).json(ok(category));
}

export async function update(req: Request, res: Response) {
  const category = await categoryService.updateCategory(req.params.id, req.body);

  await recordAudit({
    actorUserId: currentUser(req).id,
    action: "CATEGORY_UPDATED",
    targetType: "CATEGORY",
    targetId: category.id,
    metadata: { changes: req.body },
    ip: req.ip ?? null,
  });

  res.json(ok(category));
}

export async function remove(req: Request, res: Response) {
  const result = await categoryService.deleteCategory(req.params.id);

  await recordAudit({
    actorUserId: currentUser(req).id,
    action: "CATEGORY_DELETED",
    targetType: "CATEGORY",
    targetId: req.params.id,
    ip: req.ip ?? null,
  });

  res.json(ok(result));
}
