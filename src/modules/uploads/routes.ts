import express, { Router } from "express";
import { ok } from "../../lib/response";
import { asyncHandler } from "../../middleware/asyncHandler";
import { currentUser, requireAuth } from "../../middleware/auth";
import { writeLimiter } from "../../middleware/rateLimit";
import { saveImage } from "./service";

export const uploadsRouter = Router();

const MAX_UPLOAD = "20mb";

uploadsRouter.post(
  "/image",
  requireAuth,
  writeLimiter,
  express.raw({
    type: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "video/mp4",
      "video/webm",
    ],
    limit: MAX_UPLOAD,
  }),
  asyncHandler(async (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    res.status(201).json(ok(await saveImage(body, currentUser(req).id)));
  })
);
