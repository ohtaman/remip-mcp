#!/usr/bin/env node
import { createRequire } from 'node:module';
import path from 'node:path';
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { logger } from './app/logger.js';
import { processCommandOptions } from './app/config.js';
import {
  startReMIPServer,
  cleanupReMIPProcess,
  ReMIPInfo,
} from './app/remipProcess.js';
import { setupAppServer } from './app/httpServer.js';
import { ReMIPClient } from './connectors/remip/ReMIPClient.js';
import { StorageService } from './app/storage.js';
import { PyodideRunner } from './app/pyodideRunner.js';
import { generateMipProblem } from './tools/generateMipProblem.js';
import { solveMipProblem } from './tools/solveMipProblem.js';
import { processMipSolution } from './tools/processMipSolution.js';
import { z } from 'zod';

interface McpExtraArgs {
  sessionId?: string;
}

const require = createRequire(import.meta.url);

const generateMipProblemSchema = z.object({
  problemDefinitionCode: z.string(),
});

const solveMipProblemSchema = z.object({
  problemId: z.string(),
});

const processMipSolutionSchema = z.object({
  solutionId: z.string(),
  validationCode: z.string(),
});

function installProcessHandlers() {
  (['SIGINT', 'SIGTERM', 'SIGHUP'] as NodeJS.Signals[]).forEach((sig) => {
    process.on(sig, () => {
      cleanupReMIPProcess(logger);
      logger.info({ event: 'process_exit' }, sig);
      process.exit(0);
    });
  });

  process.on('uncaughtException', (err: Error) => {
    cleanupReMIPProcess(logger);
    logger.fatal({ event: 'process_exit', err }, 'uncaughtException');
    logger.flush();
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    cleanupReMIPProcess(logger);
    const err = new Error(`Unhandled Rejection. Reason: ${reason}`);
    logger.fatal(
      { event: 'process_exit', reason: reason, stack: err.stack },
      'unhandledRejection',
    );
    logger.flush();
    process.exit(1);
  });
}

async function setupMcpServer(
  transport: StreamableHTTPServerTransport | StdioServerTransport,
  remipClient: ReMIPClient,
  storageService: StorageService,
  pyodideRunner: PyodideRunner,
): Promise<McpServer> {
  const mcpServer = new McpServer(
    {
      name: 'remip-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  mcpServer.registerTool(
    'generate_mip_problem',
    {
      description:
        "Generates a Mixed-Integer Programming (MIP) problem from a Python script using the PuLP library.\n\n**Constraint:** The script must create **exactly one** instance of a `pulp.LpProblem` object in the global scope. The name of the variable does not matter, but there must be only one.\n\nThe tool executes the script, finds the single `LpProblem` object, serializes it, and stores it. It returns a unique `problemId` for the stored problem, along with any output from the script's stdout and stderr streams.",
      inputSchema: generateMipProblemSchema.shape,
    },
    async (
      params: z.infer<typeof generateMipProblemSchema>,
      extra: McpExtraArgs,
    ) => {
      const sessionId = extra.sessionId!;
      try {
        const result = await generateMipProblem(sessionId, params, {
          pyodideRunner,
          storageService,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } finally {
        pyodideRunner.cleanup(sessionId);
        logger.info(
          { event: 'pyodide_cleanup', sessionId },
          'Pyodide instance cleaned up.',
        );
      }
    },
  );
  logger.info('Registered method: generate_mip_problem');

  mcpServer.registerTool(
    'solve_mip_problem',
    {
      description:
        'Solves a previously generated Mixed-Integer Programming (MIP) problem. It retrieves the problem definition using the provided problem ID and submits it to a ReMIP (Remote MIP) solver. The tool streams logs and metrics from the solver and returns the final solution along with a unique solution ID.',
      inputSchema: solveMipProblemSchema.shape,
    },
    // @ts-expect-error - The McpServer's inferred type for sendNotification is highly specific and
    // difficult to satisfy without making the tool's code overly complex. The runtime behavior is correct.
    async (
      params: z.infer<typeof solveMipProblemSchema>,
      extra: McpExtraArgs & {
        sendNotification: (notification: {
          method: string;
          params: unknown;
        }) => Promise<void>;
      },
    ) => {
      const sessionId = extra.sessionId!;
      const result = await solveMipProblem(sessionId, params, {
        storageService,
        remipClient,
        sendNotification: extra.sendNotification,
      });
      return { content: [{ type: 'text', text: JSON.stringify(result) }] };
    },
  );
  logger.info('Registered method: solve_mip_problem');

  mcpServer.registerTool(
    'process_mip_solution',
    {
      description:
        "Processes a MIP solution using a Python script for validation or analysis. This tool retrieves a stored solution and executes the provided Python code. The solution data is injected into the script's global scope as a variable named `solution`. The tool returns a status message, along with any output from the script's stdout and stderr streams.",
      inputSchema: processMipSolutionSchema.shape,
    },
    async (
      params: z.infer<typeof processMipSolutionSchema>,
      extra: McpExtraArgs,
    ) => {
      const sessionId = extra.sessionId!;
      try {
        const result = await processMipSolution(sessionId, params, {
          pyodideRunner,
          storageService,
        });
        return { content: [{ type: 'text', text: JSON.stringify(result) }] };
      } finally {
        pyodideRunner.cleanup(sessionId);
        logger.info(
          { event: 'pyodide_cleanup', sessionId },
          'Pyodide instance cleaned up.',
        );
      }
    },
  );
  logger.info('Registered method: process_mip_solution');

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
      logger.info(
        {
          event: 'subprocess_ready',
          url: `http://${remipInfo.host}:${remipInfo.port}`,
        },
        'ReMIP server ready',
      );
    } catch (err) {
      logger.fatal(
        { event: 'process_exit', err },
        'Could not start ReMIP server.',
      );
      cleanupReMIPProcess(logger);
      logger.flush();
      process.exit(1);
    }
  }

  const remipClient = new ReMIPClient({
    logger: logger.child({ service: 'ReMIPClient' }),
    baseUrl: `http://${remipInfo.host}:${remipInfo.port}`,
  });

  logger.info({ event: 'server_start', config }, 'Starting MCP Server.');

  const storageService = new StorageService();
  // In production, files are in `dist`, and we copy pyodide to `dist/pyodide`.
  // In development, `ts-node` runs from the root, so we resolve from `node_modules`.
  const isProd = !import.meta.url.startsWith('file://');
  const pyodidePath = isProd
    ? path.join(path.dirname(import.meta.url), 'pyodide')
    : path.dirname(require.resolve('pyodide/package.json'));
  const pyodideRunner = new PyodideRunner(pyodidePath, config.pyodidePackages);

  if (config.http) {
    const mcpSessionFactory = async (
      sessionIdGenerator: () => string,
      onSessionClosed: (sessionId: string) => void,
    ) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator,
        onsessionclosed: (sessionId: string) => {
          onSessionClosed(sessionId);
          storageService.clearSession(sessionId);
          logger.info(
            { event: 'session_closed', sessionId: sessionId },
            'Session closed.',
          );
        },
      });
      const mcpServer = await setupMcpServer(
        transport,
        remipClient,
        storageService,
        pyodideRunner,
      );
      return { transport, mcpServer };
    };
    setupAppServer(config.port, logger, mcpSessionFactory);
  } else {
    const transport = new StdioServerTransport();
    await setupMcpServer(transport, remipClient, storageService, pyodideRunner);
    process.stdin.on('close', () => {
      logger.info({ event: 'stdin_closed' }, 'STDIN closed, shutting down.');
      cleanupReMIPProcess(logger);
      process.exit(0);
    });
  }
}

main().catch((err) => {
  logger.fatal({ event: 'exit', err }, 'An unexpected error occurred in main');
  logger.flush();
  process.exit(1);
});
