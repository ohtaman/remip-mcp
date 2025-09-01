// src/logger.ts
import pino, { Logger } from "pino";

export const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "remip-mcp",
    env: process.env.NODE_ENV ?? "dev",
    version: process.env.APP_VERSION ?? "dev",
  },
  serializers: { err: pino.stdSerializers.err },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "config.remipInfo.token",
    ],
    censor: "[REDACTED]",
  },
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : {
          target: "pino-pretty",
          options: { translateTime: "SYS:standard", singleLine: true },
        },
});

export const httpLog = logger.child({ component: "http" });