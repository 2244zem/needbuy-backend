import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import { listTransactionsQuery, topupIdParams, topupSchema, withdrawalSchema } from "./schema";

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", asyncHandler(controller.detail));

walletRouter.get(
  "/transactions",
  validate({ query: listTransactionsQuery }),
  asyncHandler(controller.transactions)
);

walletRouter.post(
  "/topup",
  writeLimiter,
  validate({ body: topupSchema }),
  asyncHandler(controller.topup)
);

walletRouter.post(
  "/withdrawals",
  writeLimiter,
  validate({ body: withdrawalSchema }),
  asyncHandler(controller.requestWithdrawal)
);

walletRouter.post(
  "/topup/:id/sync",
  validate({ params: topupIdParams }),
  asyncHandler(controller.syncTopup)
);
