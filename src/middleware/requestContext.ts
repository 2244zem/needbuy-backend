import type { RequestHandler } from "express";
import pinoHttp from "pino-http";
import { v4 as uuid } from "uuid";
import { logger } from "../config/logger";

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header("x-request-id");
  req.requestId = incoming && incoming.length <= 128 ? incoming : uuid();
  res.setHeader("X-Request-Id", req.requestId);
  next();
};

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => (req as { requestId?: string }).requestId ?? uuid(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.remoteAddress,
    }),
    res: (res) => ({ statusCode: res.statusCode }),
    err: (err) => ({ message: err.message, stack: err.stack }),
  },

  customSuccessMessage: (req, res, responseTime) => {
    return `${req.method} ${req.url} -> ${res.statusCode} (${Math.round(responseTime)}ms)`;
  },
  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} -> ${res.statusCode}: ${err.message}`;
  },
  autoLogging: {
    ignore: (req) => req.url === "/health" || req.url === "/ready",
  },
});
