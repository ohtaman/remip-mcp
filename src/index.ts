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
import { z } from 'zod';

// New Tool Imports
import { defineModel } from './tools/defineModel.js';
import { solveProblem } from './tools/solveProblem.js';
import { getSolution } from './tools/getSolution.js';
import { processSolution } from './tools/processSolution.js';
import { listModels } from './tools/listModels.js';
import { getModel } from './tools/getModel.js';
import { listSolutions } from './tools/listSolutions.js';
import {
  defineModelSchema,
  getModelSchema,
  getSolutionSchema,
  processSolutionSchema,
  solveProblemSchema,
  defineModelOutputSchema,
  getModelOutputSchema,
  getSolutionOutputSchema,
  listModelsOutputSchema,
  listSolutionsOutputSchema,
  processSolutionOutputSchema,
  solveProblemOutputSchema,
} from './schemas/toolSchemas.js';

interface McpExtraArgs {
  sessionId?: string;
}

const require = createRequire(import.meta.url);

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

  // --- Register New Tools ---

  mcpServer.registerTool(
    'define_model',
    {
      description:
        'Defines or updates a reusable optimization model template. Requirements: (1) Define exactly one pulp.LpProblem globally in model code (e.g., prob = pulp.LpProblem(...)). (2) inputs array specifies required data keys for solve_problem (if inputs is empty, pass data={}). Tips: Add objective/constraints to prob, avoid defining multiple LpProblem instances.',
      inputSchema: defineModelSchema.shape,
      outputSchema: defineModelOutputSchema.shape,
    },
    async (params: z.infer<typeof defineModelSchema>, extra: McpExtraArgs) => {
      const result = await defineModel(extra.sessionId!, params, {
        storageService,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        structuredContent: result,
      };
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const solveProblemHandler: any = async (
    params: z.infer<typeof solveProblemSchema>,
    extra: McpExtraArgs & {
      sendNotification: (notification: {
        method: string;
        params: unknown;
      }) => Promise<void>;
    },
  ) => {
    logger.info(
      { event: 'solve_problem_handler.start', params },
      'Received solve_problem request',
    );
    const result = await solveProblem(extra.sessionId!, params, {
      storageService,
      remipClient,
      pyodideRunner,
      sendNotification: extra.sendNotification,
    });
    const structuredContent = {
      summary: result,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
      structuredContent,
    };
  };

  mcpServer.registerTool(
    'solve_problem',
    {
      description:
        'Executes an optimization run using a pre-defined model and specific input data. The input data is made available as global variables in the model code (e.g., if you pass {"activities": [...]}, then "activities" becomes a global variable). Prerequisites: Model must define exactly one pulp.LpProblem globally via define_model. Requirements: data keys must exactly match define_model.inputs (if inputs=[], pass data={}). Process: Execute model code with input data as global variables → discover single LpProblem from globals → solve via ReMIP → return summary. Common errors: No/multiple LpProblem instances, data key mismatch.',
      inputSchema: solveProblemSchema.shape,
      outputSchema: solveProblemOutputSchema.shape,
    },
    solveProblemHandler,
  );

  mcpServer.registerTool(
    'get_solution',
    {
      description:
        'Retrieves the complete, raw solution object for a given solution ID from solve_problem, including variable values, objective_value, and other details.',
      inputSchema: getSolutionSchema.shape,
      outputSchema: getSolutionOutputSchema.shape,
    },
    async (params: z.infer<typeof getSolutionSchema>, extra: McpExtraArgs) => {
      const result = await getSolution(extra.sessionId!, params, {
        storageService,
      });
      const structuredContent = {
        solution: result,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    'process_solution',
    {
      description:
        'Processes a solution using a Python script. The solution object is available as a native Python dictionary named `solution`. Examples: solution["objective_value"], solution["variables"]["x_A"]. Returns any JSON-serializable value.',
      inputSchema: processSolutionSchema.shape,
      outputSchema: processSolutionOutputSchema.shape,
    },
    async (
      params: z.infer<typeof processSolutionSchema>,
      extra: McpExtraArgs,
    ) => {
      const result = await processSolution(extra.sessionId!, params, {
        storageService,
        pyodideRunner,
      });
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        result,
      };
    },
  );

  mcpServer.registerTool(
    'list_models',
    {
      description:
        'Lists all models registered in the current session with their metadata.',
      inputSchema: z.object({}).shape,
      outputSchema: listModelsOutputSchema.shape,
    },
    async (params: Record<string, never>, extra: McpExtraArgs) => {
      const result = await listModels(extra.sessionId!, params, {
        storageService,
      });
      const structuredContent = {
        models: result,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    'get_model',
    {
      description:
        'Retrieves the source code and inputs for a registered model. Useful for model reuse and debugging.',
      inputSchema: getModelSchema.shape,
      outputSchema: getModelOutputSchema.shape,
    },
    async (params: z.infer<typeof getModelSchema>, extra: McpExtraArgs) => {
      const result = await getModel(extra.sessionId!, params, {
        storageService,
      });
      const structuredContent = {
        model: result,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        structuredContent,
      };
    },
  );

  mcpServer.registerTool(
    'list_solutions',
    {
      description:
        'Lists summaries of all solutions generated in the current session (solution_id, objective_value, status, etc.).',
      inputSchema: z.object({}).shape,
      outputSchema: listSolutionsOutputSchema.shape,
    },
    async (params: Record<string, never>, extra: McpExtraArgs) => {
      const result = await listSolutions(extra.sessionId!, params, {
        storageService,
      });
      const structuredContent = {
        solutions: result,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(structuredContent) }],
        structuredContent,
      };
    },
  );

  logger.info('Registered all tools.');

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
  const isProd = !import.meta.url.startsWith('file://');
  const pyodidePath = isProd
    ? path.join(path.dirname(import.meta.url), 'pyodide')
    : path.dirname(require.resolve('pyodide/package.json'));
  const pyodideRunner = new PyodideRunner(
    pyodidePath,
    config.pyodidePackages,
    config.micropipPackages,
  );

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
