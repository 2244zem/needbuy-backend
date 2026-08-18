import { Prisma } from "@prisma/client";
import type { RequestHandler } from "express";
import { prisma } from "../config/prisma";
import { AppError } from "../lib/apiError";
import { hashRequestBody } from "../lib/hash";

export const idempotency: RequestHandler = async (req, res, next) => {
  try {
    const key = req.header("idempotency-key");
    if (!key) {
      next(
        AppError.badRequest(
          "Header Idempotency-Key wajib diisi untuk endpoint ini.",
          "IDEMPOTENCY_KEY_REQUIRED"
        )
      );
      return;
    }
    if (key.length > 200) {
      next(AppError.badRequest("Idempotency-Key terlalu panjang.", "IDEMPOTENCY_KEY_INVALID"));
      return;
    }

    const requestHash = hashRequestBody(req.body);
    const endpoint = `${req.method} ${req.baseUrl}${req.path}`;

    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        next(
          AppError.conflict(
            "Idempotency-Key ini udah dipakai untuk request dengan isi berbeda.",
            "IDEMPOTENCY_KEY_REUSED"
          )
        );
        return;
      }
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }

    req.idempotency = { key, requestHash, endpoint };

    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        void prisma.idempotencyKey
          .create({
            data: {
              key,
              userId: req.user.id,
              endpoint,
              requestHash,
              statusCode: res.statusCode,
              responseBody: body as Prisma.InputJsonValue,
            },
          })
          .catch(() => undefined);
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  } catch (error) {
    next(error);
  }
};
