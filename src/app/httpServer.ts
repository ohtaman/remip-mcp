// src/http-server.ts
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Logger } from "pino";
import { randomUUID } from "crypto";

export function setupAppServer(
  mcpServer: McpServer,
  port: number,
  transport: StreamableHTTPServerTransport,
  logger: Logger
) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const reqId = (req.headers["x-request-id"] as string) ?? randomUUID();
    res.setHeader("x-request-id", reqId);
    // Use child logger
    (req as any).log = logger.child({ req_id: reqId });

    res.on("finish", () => {
      const latency_ms = Number(
        (process.hrtime.bigint() - start) / 1_000_000n
      );
      (req as any).log.info(
        {
          event: "http_access",
          method: req.method,
          path: req.path,
          status: res.statusCode,
          latency_ms,
        },
        "http request"
      );
    });
    next();
  });

  app.get("/health", async (req, res) => {
    (req as any).log?.info({ event: "health_check" }, "Health check OK");
    res.status(200).end();
  });

  app.post("/mcp", async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      (req as any).log?.error(
        { event: "mcp_request_error", err },
        "Error handling MCP request"
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    (req as any).log?.info({ event: "mcp_get_request" }, "GET /mcp not allowed");
    res
      .writeHead(405)
      .end(
        JSON.stringify({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Method not allowed." },
          id: null,
        })
      );
  });

  app.listen(port, () => {
    logger.info(
      { event: "server_listen", url: `http://localhost:${port}` },
      `Application server listening at http://localhost:${port}`
    );
  });
}