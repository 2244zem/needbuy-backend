import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "./env";
import { logger } from "./logger";

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "query" },
      { emit: "event", level: "warn" },
      { emit: "event", level: "error" },
    ],
  });

  client.$on("query", (event) => {
    if (event.duration >= env.SLOW_QUERY_MS) {
      logger.warn({ durationMs: event.duration, query: event.query }, "slow query");
    }
  });

  client.$on("warn", (event) => logger.warn({ prisma: event.message }, "prisma warning"));
  client.$on("error", (event) => logger.error({ prisma: event.message }, "prisma error"));

  return client;
}

export const prisma = global.__prisma ?? createPrismaClient();

if (!isProduction) {
  global.__prisma = prisma;
}
