import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as paymentsService from "../payments/service";
import * as walletService from "./service";

export async function detail(req: Request, res: Response) {
  res.json(ok(await walletService.getWallet(currentUser(req).id)));
}

export async function transactions(req: Request, res: Response) {
  const { items, meta } = await walletService.listTransactions(
    currentUser(req).id,
    req.query as never
  );
  res.json(ok(items, meta));
}

export async function requestWithdrawal(req: Request, res: Response) {
  const created = await walletService.requestWithdrawal(currentUser(req).id, req.body);
  res.status(201).json(ok(created));
}

export async function topup(req: Request, res: Response) {
  const created = await walletService.startTopup(currentUser(req).id, req.body.amount);
  res.status(201).json(ok(created));
}

export async function syncTopup(req: Request, res: Response) {
  res.json(ok(await paymentsService.syncTopup(currentUser(req).id, req.params.id)));
}

export async function pinStatus(req: Request, res: Response) {
  res.json(ok(await walletService.getPinStatus(currentUser(req).id)));
}

export async function setPin(req: Request, res: Response) {
  res.json(
    ok(await walletService.setPin(currentUser(req).id, req.body.newPin, req.body.currentPin))
  );
}

export async function lookupAccount(req: Request, res: Response) {
  res.json(ok(await walletService.lookupAccount(String(req.query.accountNumber))));
}

export async function transfer(req: Request, res: Response) {
  res.json(ok(await walletService.transfer(currentUser(req).id, req.body)));
}
