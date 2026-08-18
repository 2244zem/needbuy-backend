import { z } from "zod";
import { MAX_TOPUP, MAX_WITHDRAWAL, MIN_TOPUP, MIN_WITHDRAWAL } from "../../lib/needpay";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";

export const topupSchema = z
  .object({
    amount: z.number().int().min(MIN_TOPUP).max(MAX_TOPUP),
  })
  .strict();

export const listTransactionsQuery = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strict();

export const topupIdParams = z.object({ id: z.string().uuid() }).strict();

export const withdrawalSchema = z
  .object({
    amount: z.number().int().min(MIN_WITHDRAWAL).max(MAX_WITHDRAWAL),
    bankName: z.string().trim().min(2).max(60),
    
    bankAccount: z
      .string()
      .trim()
      .min(6)
      .max(30)
      .regex(/^[0-9-]+$/, "Nomor rekening cuma boleh angka dan tanda hubung"),
    bankAccountName: z.string().trim().min(2).max(80),
  })
  .strict();

export type TopupInput = z.infer<typeof topupSchema>;
export type WithdrawalInput = z.infer<typeof withdrawalSchema>;
