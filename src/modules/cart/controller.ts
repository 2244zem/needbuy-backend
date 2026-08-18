import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as cartService from "./service";
import { cartItemResponse, cartResponse } from "./schema";

export async function get(req: Request, res: Response) {
  res.json(ok(cartResponse.parse(await cartService.getCart(currentUser(req).id))));
}

export async function getCount(req: Request, res: Response) {
  res.json(ok(await cartService.getCartCount(currentUser(req).id)));
}

export async function addItem(req: Request, res: Response) {
  const item = await cartService.addItem(
    currentUser(req).id,
    req.body.productId,
    req.body.quantity,
    req.body.variant
  );
  res.status(201).json(ok(cartItemResponse.parse(item)));
}

export async function updateItem(req: Request, res: Response) {
  const item = await cartService.updateItem(currentUser(req).id, req.params.id, req.body.quantity);
  res.json(ok(cartItemResponse.parse(item)));
}

export async function removeItem(req: Request, res: Response) {
  res.json(ok(await cartService.removeItem(currentUser(req).id, req.params.id)));
}

export async function clear(req: Request, res: Response) {
  res.json(ok(await cartService.clearCart(currentUser(req).id)));
}

export async function setBudget(req: Request, res: Response) {
  res.json(ok(await cartService.setBudget(currentUser(req).id, req.body.budget)));
}
