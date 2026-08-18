import { z } from "zod";
import { isoDate, nullableIsoDate } from "../../lib/dtoPrimitives";

export const paymentResponse = z.object({
  id: z.string(),
  status: z.string(),
  method: z.string().nullable(),
  snapToken: z.string().nullable(),
  snapRedirectUrl: z.string().nullable(),
  midtransOrderId: z.string().nullable(),
  paidAt: nullableIsoDate,
  createdAt: isoDate,
});