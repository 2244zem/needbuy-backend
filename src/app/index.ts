import cors from "cors";
import express, { type Express, type RequestHandler } from "express";
import helmet from "helmet";
import fs from "node:fs";
import path from "node:path";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import { allowedOrigins, env } from "../config/env";
import { logger } from "../config/logger";
import { prisma } from "../config/prisma";
import { ok } from "../lib/response";
import { asyncHandler } from "../middleware/asyncHandler";
import { errorHandler, notFoundHandler } from "../middleware/errorHandler";
import { globalLimiter } from "../middleware/rateLimit";
import { httpLogger, requestContext } from "../middleware/requestContext";
import { UPLOAD_URL_PREFIX, getImage } from "../modules/uploads";
import { apiV1Router } from "./router";

export function buildApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(requestContext);
  app.use(httpLogger);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("Not allowed by CORS"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: true,
    })
  );
  app.use(helmet());
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ extended: false, limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json(ok({ status: "ok" }));
  });

  app.get(
    "/ready",
    asyncHandler(async (_req, res) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        res.json(ok({ status: "ready" }));
      } catch (error) {
        logger.error({ err: error }, "readiness check failed");
        res.status(503).json(ok({ status: "degraded" }));
      }
    })
  );

  mountSwagger(app);
  mountUploads(app);

  const skipLimiterForWebhook: RequestHandler = (req, res, next) =>
    req.path === "/payments/midtrans/webhook" ? next() : globalLimiter(req, res, next);

  app.use("/api/v1", skipLimiterForWebhook, apiV1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

function mountUploads(app: Express) {
  app.get(
    `${UPLOAD_URL_PREFIX}/:id`,
    asyncHandler(async (req, res) => {
      const upload = await getImage(req.params.id);

      res.setHeader("Content-Type", upload.mimeType);
      res.setHeader("Content-Length", String(upload.size));
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("ETag", `"${upload.id}"`);

      if (req.headers["if-none-match"] === `"${upload.id}"`) {
        res.status(304).end();
        return;
      }

      res.send(Buffer.from(upload.data));
    })
  );
}

function mountSwagger(app: Express) {
  const specPath = path.resolve(process.cwd(), "docs", "swagger.yaml");
  if (!fs.existsSync(specPath)) {
    logger.warn({ specPath }, "swagger.yaml nggak ketemu, /docs dilewati");
    return;
  }

  try {
    const document = YAML.parse(fs.readFileSync(specPath, "utf8")) as Record<string, unknown>;
    document.servers = [{ url: `${env.API_BASE_URL}/api/v1` }];

    const docsHelmet = helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
    });

    app.use("/docs", docsHelmet, swaggerUi.serve, swaggerUi.setup(document));
  } catch (error) {
    logger.error({ err: error }, "gagal memuat swagger.yaml");
  }
}