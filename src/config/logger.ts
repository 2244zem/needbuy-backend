import pino from "pino";
import { env } from "./env";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-api-key']",
  "res.headers['set-cookie']",
  "*.password",
  "*.passwordConfirmation",
  "*.passwordHash",
  "*.refreshToken",
  "*.accessToken",
  "*.tokenHash",
  "*.snapToken",
  "*.signature_key",
  "*.signatureKey",
  "*.serverKey",
  "*.MIDTRANS_SERVER_KEY",
  "*.JWT_SECRET",
  "*.JWT_REFRESH_SECRET",
  "body.password",
  "body.refreshToken",
];

const isDev = env.NODE_ENV === "development";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: "[REDACTED]" },
  base: isDev ? {} : { service: "needbuy-backend" },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(isDev
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname,service,req,res,reqId,responseTime",
            singleLine: false,
            errorProps: "err.message,err.stack,code,requestId,durationMs,statusCode,query",
          },
        },
      }
    : {}),
});

export async function withExternalCall<T>(
  service: string,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    const result = await fn();
    logger.info({ service, operation, durationMs: Date.now() - startedAt }, "external call ok");
    return result;
  } catch (error) {
    logger.error(
      {
        service,
        operation,
        durationMs: Date.now() - startedAt,
        err: error instanceof Error ? { message: error.message, name: error.name } : error,
      },
      "external call failed"
    );
    throw error;
  }
}