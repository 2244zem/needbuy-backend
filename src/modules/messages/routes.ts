import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  conversationIdParams,
  listMessagesQuery,
  sendMessageSchema,
  startConversationSchema,
} from "./schema";

export const messagesRouter = Router();

messagesRouter.use(requireAuth);

messagesRouter.get("/conversations", asyncHandler(controller.listConversations));

messagesRouter.post(
  "/conversations",
  writeLimiter,
  validate({ body: startConversationSchema }),
  asyncHandler(controller.startConversation)
);

messagesRouter.get(
  "/conversations/:id/messages",
  validate({ params: conversationIdParams, query: listMessagesQuery }),
  asyncHandler(controller.listMessages)
);

messagesRouter.post(
  "/conversations/:id/messages",
  writeLimiter,
  validate({ params: conversationIdParams, body: sendMessageSchema }),
  asyncHandler(controller.sendMessage)
);
