import { Router } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { optionalAuth, requireAuth, requireRole } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { validate } from "../../middleware/validate";
import { listReviewsQuery } from "../reviews/schema";
import * as reviewController from "../reviews/controller";
import * as controller from "./products.controller";
import {
  addAttributeSchema,
  addImagesSchema,
  createProductSchema,
  listProductsQuery,
  productAttributeParams,
  productIdParams,
  productImageParams,
  productSlugParams,
  replaceAttributesSchema,
  updateImageSchema,
  updateProductSchema,
} from "./products.schema";

export const productsRouter = Router();

productsRouter.get("/", validate({ query: listProductsQuery }), asyncHandler(controller.list));

productsRouter.get(
  "/:id/reviews",
  validate({ params: productIdParams, query: listReviewsQuery }),
  asyncHandler(reviewController.listForProduct)
);

productsRouter.post(
  "/:id/view",
  optionalAuth,
  validate({ params: productIdParams }),
  asyncHandler(controller.recordView)
);

const sellerOnly = [requireAuth, requireRole("SELLER", "ADMIN"), writeLimiter] as const;

productsRouter.post(
  "/",
  ...sellerOnly,
  validate({ body: createProductSchema }),
  asyncHandler(controller.create)
);
productsRouter.patch(
  "/:id",
  ...sellerOnly,
  validate({ params: productIdParams, body: updateProductSchema }),
  asyncHandler(controller.update)
);
productsRouter.delete(
  "/:id",
  ...sellerOnly,
  validate({ params: productIdParams }),
  asyncHandler(controller.remove)
);
productsRouter.put(
  "/:id/attributes",
  ...sellerOnly,
  validate({ params: productIdParams, body: replaceAttributesSchema }),
  asyncHandler(controller.replaceAttributes)
);
productsRouter.post(
  "/:id/images",
  ...sellerOnly,
  validate({ params: productIdParams, body: addImagesSchema }),
  asyncHandler(controller.addImages)
);
productsRouter.patch(
  "/:id/images/:imageId",
  ...sellerOnly,
  validate({ params: productImageParams, body: updateImageSchema }),
  asyncHandler(controller.updateImage)
);
productsRouter.delete(
  "/:id/images/:imageId",
  ...sellerOnly,
  validate({ params: productImageParams }),
  asyncHandler(controller.removeImage)
);
productsRouter.post(
  "/:id/attributes",
  ...sellerOnly,
  validate({ params: productIdParams, body: addAttributeSchema }),
  asyncHandler(controller.addAttribute)
);
productsRouter.delete(
  "/:id/attributes/:attrId",
  ...sellerOnly,
  validate({ params: productAttributeParams }),
  asyncHandler(controller.removeAttribute)
);
productsRouter.get(
  "/category/:slug",
  validate({ query: listProductsQuery }),
  asyncHandler(controller.listByCategorySlug)
);

productsRouter.get(
  "/:slug",
  optionalAuth,
  validate({ params: productSlugParams }),
  asyncHandler(controller.detail)
);
