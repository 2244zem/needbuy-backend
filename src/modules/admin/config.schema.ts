import { z } from "zod";
import { CONFIG_KEYS, WRITABLE_CONFIG_KEYS } from "./config.service";

export const configKeyParams = z.object({ key: z.string() }).strict();

const URL_KEYS: string[] = [CONFIG_KEYS.BRAND_LOGO_URL, CONFIG_KEYS.BRAND_FAVICON_URL];

export const setConfigSchema = z
  .object({
    key: z.enum(WRITABLE_CONFIG_KEYS as [string, ...string[]]),
    value: z.string().max(2000),
  })
  .strict()
  .refine((v) => !URL_KEYS.includes(v.key) || v.value === "" || /^https?:\/\//.test(v.value), {
    message: "URL harus diawali http:// atau https://",
    path: ["value"],
  });
