import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import * as controller from "./controller";
import {
  listTransactionsQuery,
  lookupAccountQuery,
  setPinSchema,
  topupIdParams,
  topupSchema,
  transferSchema,
  withdrawalSchema,
} from "./schema";
import { idempotency } from "../../middleware/idempotency";

export const walletRouter = Router();

walletRouter.use(requireAuth);

walletRouter.get("/", asyncHandler(controller.detail));

walletRouter.get(
  "/transactions",
  validate({ query: listTransactionsQuery }),
  asyncHandler(controller.transactions)
);

walletRouter.get("/pin", asyncHandler(controller.pinStatus));

walletRouter.post(
  "/pin",
  writeLimiter,
  validate({ body: setPinSchema }),
  asyncHandler(controller.setPin)
);

walletRouter.get(
  "/lookup",
  validate({ query: lookupAccountQuery }),
  asyncHandler(controller.lookupAccount)
);

// Idempotency-Key wajib: transfer yang terkirim dua kali karena klik dobel
// atau retry jaringan berarti uang berpindah dua kali.
walletRouter.post(
  "/transfer",
  writeLimiter,
  validate({ body: transferSchema }),
  idempotency,
  asyncHandler(controller.transfer)
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
