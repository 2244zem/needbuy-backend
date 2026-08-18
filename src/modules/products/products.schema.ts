import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../../lib/pagination";
import { isoDate, money, rating } from "../../lib/dtoPrimitives";

const moneySchema = z
  .union([z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, "Format harga nggak valid"), z.number()])
  .refine((value) => Number(value) >= 0, "Harga nggak boleh negatif");

export const PRODUCT_SORT_FIELDS = [
  "newest",
  "price_asc",
  "price_desc",
  "rating",
  "sold",
] as const;

export const listProductsQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    categoryId: z.string().uuid().optional(),
    
    categorySlugs: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((value) =>
        value ? value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50) : undefined
      ),
    
    conditions: z
      .string()
      .trim()
      .max(200)
      .optional()
      .transform((value) =>
        value ? value.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10) : undefined
      ),
    sellerId: z.string().uuid().optional(),
    minPrice: z.coerce.number().nonnegative().optional(),
    maxPrice: z.coerce.number().nonnegative().optional(),
    
    onSale: z
      .enum(["true", "false", "1", "0"])
      .transform((value) => value === "true" || value === "1")
      .optional(),
    sort: z.enum(PRODUCT_SORT_FIELDS).default("newest"),
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  })
  .strip()
  .refine(
    (value) => value.minPrice === undefined || value.maxPrice === undefined || value.minPrice <= value.maxPrice,
    { message: "minPrice nggak boleh lebih besar dari maxPrice", path: ["minPrice"] }
  );

export const productSlugParams = z.object({ slug: z.string().trim().min(1).max(200) }).strict();
export const productIdParams = z.object({ id: z.string().uuid() }).strict();

export const createProductSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    categoryId: z.string().uuid(),
    description: z.string().trim().max(5000).optional(),
    price: moneySchema,
    stock: z.number().int().min(0).max(1_000_000),
    attributes: z
      .array(
        z.object({
          attrKey: z.string().trim().min(1).max(60),
          attrValue: z.string().trim().min(1).max(200),
        })
      )
      .max(50)
      .optional(),
    images: z
      .array(
        z.object({
          url: z.string().url().max(2000),
          isPrimary: z.boolean().default(false),
          sortOrder: z.number().int().min(0).max(100).default(0),
        })
      )
      .max(20)
      .optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(3).max(200).optional(),
    categoryId: z.string().uuid().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    price: moneySchema.optional(),
    stock: z.number().int().min(0).max(1_000_000).optional(),
    isActive: z.boolean().optional(),
    discountPercent: z.number().int().min(0).max(90).optional(),
  })
  .strict();

export const replaceAttributesSchema = z
  .object({
    attributes: z
      .array(
        z.object({
          attrKey: z.string().trim().min(1).max(60),
          attrValue: z.string().trim().min(1).max(200),
        })
      )
      .max(50),
  })
  .strict();

export const addImagesSchema = z
  .object({
    images: z
      .array(
        z.object({
          url: z.string().url().max(2000),
          isPrimary: z.boolean().default(false),
          sortOrder: z.number().int().min(0).max(100).default(0),
        })
      )
      .min(1)
      .max(20),
  })
  .strict();

export const productImageParams = z
  .object({ id: z.string().uuid(), imageId: z.string().uuid() })
  .strict();

export const productAttributeParams = z
  .object({ id: z.string().uuid(), attrId: z.string().uuid() })
  .strict();

export const updateImageSchema = z
  .object({
    isPrimary: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Minimal satu field harus diisi",
  });

export const addAttributeSchema = z
  .object({
    attrKey: z.string().trim().min(1).max(60),
    attrValue: z.string().trim().min(1).max(200),
  })
  .strict();

export type ListProductsQuery = z.infer<typeof listProductsQuery>;
export type UpdateImageInput = z.infer<typeof updateImageSchema>;
export type AddAttributeInput = z.infer<typeof addAttributeSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

export const productImageResponse = z.object({
  url: z.string(),
  isPrimary: z.boolean().optional(),
  sortOrder: z.number().optional(),
});

export const productListItemResponse = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  price: money,
  stock: z.number(),
  rating: rating,
  soldCount: z.number(),
  isActive: z.boolean(),
  createdAt: isoDate,
  category: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  seller: z.object({
    id: z.string(),
    storeName: z.string(),
    rating: rating,
    status: z.string(),
  }),
  images: z.array(productImageResponse),
});

export const productListResponse = z.array(productListItemResponse);

export type ProductListItemResponse = z.infer<typeof productListItemResponse>;
