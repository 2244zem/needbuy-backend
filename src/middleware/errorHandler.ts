import { Prisma } from "@prisma/client";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { AppError, isAppError } from "../lib/apiError";
import { fail } from "../lib/response";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError(404, "ROUTE_NOT_FOUND", `Endpoint ${req.method} ${req.path} nggak ada.`));
};

function isPayloadTooLarge(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const candidate = err as { type?: string; status?: number; statusCode?: number };
  return (
    candidate.type === "entity.too.large" ||
    candidate.status === 413 ||
    candidate.statusCode === 413
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId;

  if (isAppError(err)) {
    if (err.status >= 500) {
      logger.error({ requestId, code: err.code, err }, "app error 5xx");
    }
    res
      .status(err.status)
      .json(fail(err.code, err.message, err.fields, requestId));
    return;
  }

  if (err instanceof ZodError) {
    const fields = err.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    res
      .status(422)
      .json(fail("VALIDATION_ERROR", "Data yang dikirim nggak valid.", fields, requestId));
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json(fail("BAD_REQUEST", "Body request bukan JSON yang valid.", undefined, requestId));
    return;
  }

  if (isPayloadTooLarge(err)) {
    res
      .status(413)
      .json(fail("PAYLOAD_TOO_LARGE", "Berkas atau data yang dikirim terlalu besar.", undefined, requestId));
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json(fail("CONFLICT", "Data dengan nilai unik yang sama udah ada.", undefined, requestId));
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json(fail("NOT_FOUND", "Resource nggak ketemu.", undefined, requestId));
      return;
    }
    if (err.code === "P2003") {
      res.status(409).json(fail("CONFLICT", "Relasi data nggak valid.", undefined, requestId));
      return;
    }
    if (err.code === "P2034") {
      res.status(409).json(
        fail("WRITE_CONFLICT", "Terjadi bentrok data, coba lagi ya.", undefined, requestId)
      );
      return;
    }
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.error({ requestId, err }, "database unavailable");
    res.status(503).json(
      fail("SERVICE_UNAVAILABLE", "Layanan sedang nggak tersedia.", undefined, requestId)
    );
    return;
  }

  logger.error({ requestId, err }, "unhandled error");
  res
    .status(500)
    .json(fail("INTERNAL_ERROR", "Internal server error", undefined, requestId));
};