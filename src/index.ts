// src/index.ts
import { randomUUID } from "crypto";
import { Server as McpServer } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { logger } from "./app/logger.js";
import { AppConfig, processCommandOptions } from "./app/config.js";
import { startReMIPServer, cleanupReMIPProcess, ReMIPInfo } from "./app/remipProcess.js";
import { setupAppServer } from "./app/httpServer.js";
import { ReMIPClient } from "./connectors/remip/ReMIPClient.js";
import { StorageService } from './app/storage.js';
import { PyodideRunner } from './app/pyodideRunner.js';
import { generateMipProblem } from './tools/generateMipProblem.js';
import { solveMipProblem } from './tools/solveMipProblem.js';
import { validateMipSolution } from './tools/validateMipSolution.js';
import { z } from 'zod';

const generateMipProblemSchema = z.object({
  problemDefinitionCode: z.string(),
});

const solveMipProblemSchema = z.object({
  problemId: z.string(),
});

const validateMipSolutionSchema = z.object({
  solutionId: z.string(),
  validationCode: z.string(),
});

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
  remipClient: ReMIPClient,
  storageService: StorageService,
  pyodideRunner: PyodideRunner
): Promise<any> {
  const mcpServer = new McpServer(
    {
      name: "remip-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const listToolsResult = {
    tools: [
      {
        name: "generate_mip_problem",
        description: "Generates a MIP problem from a Python script.",
        inputSchema: {
          type: "object",
          properties: {
            problemDefinitionCode: { type: "string" },
          },
          required: ["problemDefinitionCode"],
        },
      },
      {
        name: "solve_mip_problem",
        description: "Solves a MIP problem.",
        inputSchema: {
          type: "object",
          properties: {
            problemId: { type: "string" },
          },
          required: ["problemId"],
        },
      },
      {
        name: "validate_mip_solution",
        description: "Validates a MIP solution.",
        inputSchema: {
          type: "object",
          properties: {
            solutionId: { type: "string" },
            validationCode: { type: "string" },
          },
          required: ["solutionId", "validationCode"],
        },
      },
    ],
  };

  mcpServer.setRequestHandler(
    z.object({ method: z.literal("tools/list") }),
    () => listToolsResult
  );

  mcpServer.setRequestHandler(
    z.object({ method: z.literal("tool/run"), params: z.object({ name: z.literal("generate_mip_problem") }).passthrough() }),
    async (req: any, extra: any) => {
      const parsed = generateMipProblemSchema.parse(req.params.parameters);
      const sessionId = extra.sessionId!;
      return await generateMipProblem(sessionId, parsed, { pyodideRunner, storageService });
    }
  );

  mcpServer.setRequestHandler(
    z.object({ method: z.literal("tool/run"), params: z.object({ name: z.literal("solve_mip_problem") }).passthrough() }),
    async (req: any, extra: any) => {
      const parsed = solveMipProblemSchema.parse(req.params.parameters);
      const sessionId = extra.sessionId!;
      return await solveMipProblem(sessionId, parsed, { storageService, remipClient });
    }
  );

  mcpServer.setRequestHandler(
    z.object({ method: z.literal("tool/run"), params: z.object({ name: z.literal("validate_mip_solution") }).passthrough() }),
    async (req: any, extra: any) => {
      const parsed = validateMipSolutionSchema.parse(req.params.parameters);
      const sessionId = extra.sessionId!;
      return await validateMipSolution(sessionId, parsed, { pyodideRunner, storageService });
    }
  );

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
      config.remipInfo = remipInfo;
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

  const storageService = new StorageService();
  const pyodideRunner = new PyodideRunner();

  if (config.http) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
    });
    const mcpServer = await setupMcpServer(transport, remipClient, storageService, pyodideRunner);
    setupAppServer(mcpServer, config.port, transport, logger);
  } else {
    const transport = new StdioServerTransport();
    await setupMcpServer(transport, remipClient, storageService, pyodideRunner);
  }
}

main().catch((err) => {
  logger.fatal({ event: "exit", err }, "An unexpected error occurred in main");
  logger.flush();
  process.exit(1);
});