import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as productService from "./products.service";
import { productListResponse } from "./products.schema";

export async function list(req: Request, res: Response) {
  const { items, meta } = await productService.list(req.query as never);
  
  res.json(ok(productListResponse.parse(items), meta));
}

export async function detail(req: Request, res: Response) {
  res.json(ok(await productService.getBySlug(req.params.slug, req.user?.id)));
}

export async function listByCategorySlug(req: Request, res: Response) {
  const { slug } = req.params;
  const { items, meta } = await productService.listByCategorySlug(slug, req.query as never);
  res.json(ok(productListResponse.parse(items), meta));
}

export async function create(req: Request, res: Response) {
  const product = await productService.create(currentUser(req).id, req.body);
  res.status(201).json(ok(product));
}

export async function update(req: Request, res: Response) {
  res.json(ok(await productService.update(currentUser(req).id, req.params.id, req.body)));
}

export async function remove(req: Request, res: Response) {
  res.json(ok(await productService.deactivate(currentUser(req).id, req.params.id)));
}

export async function replaceAttributes(req: Request, res: Response) {
  const result = await productService.replaceAttributes(
    currentUser(req).id,
    req.params.id,
    req.body.attributes
  );
  res.json(ok(result));
}

export async function addImages(req: Request, res: Response) {
  const result = await productService.addImages(currentUser(req).id, req.params.id, req.body.images);
  res.status(201).json(ok(result));
}

export async function updateImage(req: Request, res: Response) {
  const result = await productService.updateImage(
    currentUser(req).id,
    req.params.id,
    req.params.imageId,
    req.body
  );
  res.json(ok(result));
}

export async function removeImage(req: Request, res: Response) {
  const result = await productService.removeImage(
    currentUser(req).id,
    req.params.id,
    req.params.imageId
  );
  res.json(ok(result));
}

export async function addAttribute(req: Request, res: Response) {
  const result = await productService.addAttribute(currentUser(req).id, req.params.id, req.body);
  res.status(201).json(ok(result));
}

export async function removeAttribute(req: Request, res: Response) {
  const result = await productService.removeAttribute(
    currentUser(req).id,
    req.params.id,
    req.params.attrId
  );
  res.json(ok(result));
}

export async function recordView(req: Request, res: Response) {
  const result = await productService.recordView(req.params.id, req.user?.id);
  res.status(201).json(ok(result));
}
