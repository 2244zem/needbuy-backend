import { z } from "zod";
import { MAX_PAGE_SIZE } from "../../lib/pagination";
import { normalizeUploadPath } from "../../lib/uploadPath";

export const startConversationSchema = z.object({ sellerId: z.string().uuid() }).strict();

export const conversationIdParams = z.object({ id: z.string().uuid() }).strict();

export const listMessagesQuery = z
  .object({
    after: z.coerce.date().optional(),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(50),
  })
  .strict();

export const sendMessageSchema = z
  .object({
    body: z.string().trim().min(1).max(2000).optional(),
    
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .transform((value, ctx) => {
        const path = normalizeUploadPath(value);
        if (!path) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "imageUrl harus hasil unggahan NeedBuy.",
          });
          return z.NEVER;
        }
        return path;
      })
      .optional(),
  })
  .strict()
  .refine((value) => Boolean(value.body) || Boolean(value.imageUrl), {
    message: "Pesan harus berisi teks atau gambar.",
  });

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type ListMessagesQuery = z.infer<typeof listMessagesQuery>;
