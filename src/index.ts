// src/index.ts
import { randomUUID } from "crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "./app/logger.js";
import { AppConfig, processCommandOptions } from "./app/config.js";
import { startReMIPServer, cleanupReMIPProcess, ReMIPInfo } from "./app/remipProcess.js";
import { createSolveMipTool } from "./tools/solveMip.js";
import { setupAppServer } from "./app/httpServer.js";
import { ReMIPClient } from "./connectors/remip/ReMIPClient.js";

function installProcessHandlers() {
  (["SIGINT", "SIGTERM", "SIGHUP"] as NodeJS.Signals[]).forEach((sig) => {
    process.on(sig, () => {
      cleanupReMIPProcess(logger);
      logger.info({event: "process_exit"}, sig);
      process.exit(0);
    });
  });

  process.on("uncaughtException", (err: any) => {
    cleanupReMIPProcess(logger);
    logger.fatal({event: "process_exit", err}, "uncaughtException");
    logger.flush();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    cleanupReMIPProcess(logger);
    logger.fatal({event: "process_exit", reason: reason}, "unhandledRejection");
    logger.flush();
    process.exit(1);
  });
}

async function setupMcpServer(
  transport: StreamableHTTPServerTransport | StdioServerTransport,
  remipClient: ReMIPClient
): Promise<McpServer> {
  const mcpServer = new McpServer({
    name: "remip-mcp",
    version: "0.1.0",
  });

  const solveMipTool = createSolveMipTool(remipClient);
  (mcpServer as any).registerTool("solve-mip", solveMipTool);

  await mcpServer.connect(transport);
  return mcpServer;
}

async function main() {
  const config = processCommandOptions();
  installProcessHandlers();

  let remipInfo: ReMIPInfo = config.remipInfo;
  if (config.startRemipServer) {
    try {
      remipInfo = await startReMIPServer(config.remipSourceURI, logger);
      logger.info({ event: "subprocess_ready", url: `http://${remipInfo.host}:${remipInfo.port}` }, "ReMIP server ready");
    } catch (err) {
      logger.fatal({ event: "process_exit", err }, "Could not start ReMIP server.");
      cleanupReMIPProcess(logger);
      logger.flush();
      process.exit(1);
    }
  }

  const remipClient = new ReMIPClient({
      logger: logger.child({ service: "ReMIPClient" }),
      baseUrl: `http://${remipInfo.host}:${remipInfo.port}`,
  });

  logger.info({ event: "server_start", config }, "Starting MCP Server.");

  if (config.http) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
    });
    const mcpServer = await setupMcpServer(transport, remipClient);
    setupAppServer(mcpServer, config.port, transport, logger);
  } else {
    const transport = new StdioServerTransport();
    await setupMcpServer(transport, remipClient);
  }
}

main().catch((err) => {
  logger.fatal({ event: "exit", err }, "An unexpected error occurred in main");
  logger.flush();
  process.exit(1);
});