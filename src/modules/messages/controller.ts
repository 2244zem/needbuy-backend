import type { Request, Response } from "express";
import { ok } from "../../lib/response";
import { currentUser } from "../../middleware/auth";
import * as messageService from "./service";

export async function listConversations(req: Request, res: Response) {
  res.json(
    ok(
      await messageService.listConversations(
        currentUser(req).id,
        req.query.as as "buyer" | "seller" | undefined
      )
    )
  );
}

export async function startConversation(req: Request, res: Response) {
  res
    .status(201)
    .json(ok(await messageService.startConversation(currentUser(req).id, req.body.sellerId)));
}

export async function listMessages(req: Request, res: Response) {
  const messages = await messageService.listMessages(
    currentUser(req).id,
    req.params.id,
    req.query as never
  );
  res.json(ok(messages));
}

export async function sendMessage(req: Request, res: Response) {
  res
    .status(201)
    .json(ok(await messageService.sendMessage(currentUser(req).id, req.params.id, req.body)));
}
