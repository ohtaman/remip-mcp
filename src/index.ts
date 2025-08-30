import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ChildProcess, spawn } from "child_process";
import express from "express";
import { parseArgs } from "node:util";
import { z } from "zod";
import pino, { Logger } from "pino";
import { defaultConfig } from "./config.js";
import { randomUUID } from "crypto";

interface ReMIPInfo {
  host: string;
  port: number;
}

const logger: Logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: {
    service: "remip-mcp",
    env: process.env.NODE_ENV ?? "dev",
    version: process.env.APP_VERSION ?? "dev",
  },
  serializers: { err: pino.stdSerializers.err },
  redact: {
    // 将来の機密流出に備えて保守的に
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

const remipLog = logger.child({ component: "remip" });
const httpLog = logger.child({ component: "http" });

// Global variable to track the ReMIP process
let remipProcess: ChildProcess | null = null;

function startReMIPServer(): Promise<ReMIPInfo> {
  return new Promise((resolve, reject) => {
    const command = "uvx";
    const args = [
      "--from=git+https://github.com/ohtaman/remip.git#subdirectory=remip",
      "remip",
    ];

    remipLog.info(
      { event: "subprocess_spawn", command, args },
      `Executing: ${command} ${args.join(" ")}`
    );

    remipProcess = spawn(command, args, {
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let resolved = false;
    const MAX_LINE = 10_000; // ログ汚染防止に一応ガード

    remipProcess.stdout?.on("data", (data) => {
      const line = data.toString().slice(0, MAX_LINE);
      remipLog.info(
        { event: "subprocess_output", stream: "stdout", line },
        "ReMIP server stdout"
      );
    });

    remipProcess.stderr?.on("data", (data) => {
      const output = data.toString().slice(0, MAX_LINE);
      remipLog.info(
        { event: "subprocess_output", stream: "stderr", line: output },
        "ReMIP server stderr"
      );

      if (!resolved) {
        const match = output.match(/running on http:\/\/(\S+):(\d+)/i);
        if (match?.[1] && match?.[2]) {
          resolved = true;
          resolve({ host: match[1], port: parseInt(match[2], 10) });
        }
      }
    });

    remipProcess.on("close", (code) => {
      const level = code === 0 ? "info" : "fatal";
      (remipLog as any)[level](
        { event: "subprocess_exit", code },
        `ReMIP server process exited with code ${code}`
      );
      if (!resolved) {
        // まだ起動情報を返せていない場合は reject
        reject(new Error(`ReMIP server exited before ready (code ${code})`));
      }
    });

    remipProcess.on("error", (err) => {
      remipLog.fatal({ event: "subprocess_error", err }, "spawn error");
      if (!resolved) reject(err);
    });
  });
}

// Function to clean up the ReMIP process and all its children
function cleanupReMIPProcess() {
  if (remipProcess && !remipProcess.killed && remipProcess.pid) {
    remipLog.info(
      { event: "subprocess_terminate", pid: remipProcess.pid },
      `Terminating ReMIP server process (PID: ${remipProcess.pid})`
    );
    try {
      remipProcess.kill("SIGTERM");
    } catch (err) {
      remipLog.error(
        { event: "subprocess_terminate_failed", err },
        "Process kill failed"
      );
    }
  }
}

// Use pino.final to ensure logs are flushed before exit
function installProcessHandlers() {
  const finalize = (code: number, msg: string, err?: unknown) => {
    if (err instanceof Error) {
      logger.fatal({ event: "process_exit", err }, msg);
    } else if (err != null) {
      logger.fatal({ event: "process_exit", err: new Error(String(err))}, msg);
    } else {
      logger.info({ event: "process_exit" }, msg);
    }
    cleanupReMIPProcess();
    logger.flush();
    process.exit(code);
  }

  (["SIGINT", "SIGTERM", "SIGHUP"] as NodeJS.Signals[]).forEach((sig) => {
    process.on(sig, () => finalize(0, `signal received: ${sig}`));
  });

  process.on("uncaughtException", (err) =>
    finalize(1, "uncaughtException", err)
  );
  process.on("unhandledRejection", (reason) =>
    finalize(1, "unhandledRejection", reason as any)
  );
}

async function setupMcpServer(
  transport: StreamableHTTPServerTransport | StdioServerTransport,
  remipInfo: ReMIPInfo
): Promise<McpServer> {
  const mcpServer = new McpServer({
    name: "remip-mcp",
    version: "0.1.0",
  });

  mcpServer.registerTool(
    "solve-mip",
    {
      title: "Solve a MIP (Mixed Integer Programming) problem",
      description: "Solve a MIP problem",
      inputSchema: {
        code: z
          .string()
          .describe(
            "The PuLP python code to define the problem. The problem instance is automatically detected, pass to the MIP solver. If the code contains prob.solve(), it will be ignored."
          ),
        solver: z
          .string()
          .describe(
            "The MIP solver to use. If not specified, the default SCIP solver will be used."
          )
          .optional(),
        timeLimit: z
          .number()
          .describe(
            "The time limit in seconds. If not specified, the default time limit 3600 seconds will be used."
          )
          .optional(),
      },
      outputSchema: {
        status: z.union([
          z.literal("optimal").describe("The problem is solved successfully."),
          z.literal("not_solved").describe("The problem is not solved."),
          z.literal("infeasible").describe("The problem is infeasible."),
          z.literal("unbounded").describe("The problem is unbounded."),
          z.literal("undefined").describe("The problem is undefined."),
        ]),
        solution: z
          .object({
            objective: z.number().describe("The objective value of the solution."),
            variables: z
              .array(
                z.object({
                  name: z.string().describe("The name of the variable."),
                  value: z.number().describe("The value of the variable."),
                })
              )
              .describe("Decision variables and values."),
          })
          .nullable(),
        error_message: z.string().nullable(),
        logs: z.array(z.string()).nullable(),
      },
    },
    async ({ code }) => {
      // TODO: 実装本体は別PRで。ここではダミー。
      return {
        structuredContent: {
          status: "not_solved",
          solution: null,
          error_message: null,
          logs: null,
        },
        content: [{ type: "text", text: "Solving the problem..." }],
        isError: false,
      };
    }
  );

  await mcpServer.connect(transport);
  return mcpServer;
}

function setupAppServer(
  mcpServer: McpServer,
  port: number,
  transport: StreamableHTTPServerTransport
) {
  const app = express();
  app.use(express.json());

  // ---- HTTP共通メタ（req_id, latency）付与
  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const reqId = (req.headers["x-request-id"] as string) ?? randomUUID();
    res.setHeader("x-request-id", reqId);
    // 子ロガーをぶら下げる
    (req as any).log = httpLog.child({ req_id: reqId });

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
    httpLog.info(
      { event: "server_listen", url: `http://localhost:${port}` },
      `Application server listening at http://localhost:${port}`
    );
  });
}

async function main() {
  installProcessHandlers();

  // 1. CLI options
  const options = {
    http: { type: "boolean" },
    port: { type: "string" },
    "remip-host": { type: "string" },
    "remip-port": { type: "string" },
    "start-remip-server": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  } as const;

  // 2. Parse args
  const { values: cliArgs } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2),
    options,
  });

  // 3. Help
  if (cliArgs.help) {
    // ログと混在させないためstdoutに直接
    process.stdout.write(
      `
Usage: node index.js [options]

Options:
  --http                       Start an HTTP server (Default: ${defaultConfig.http})
  --port <port>                Port for this application server (Default: ${defaultConfig.port})
  --remip-host <host>          Hostname of the ReMIP server (Default: ${defaultConfig.remipServer.host})
  --remip-port <port>          Port of the ReMIP server (Default: ${defaultConfig.remipServer.port})
  --start-remip-server         Start a local ReMIP server on launch (Default: ${defaultConfig.startRemipServer})
  -h, --help                   Show this help message
`.trimStart()
    );
    return;
  }

  // 4. Merge config
  const config = {
    http: cliArgs.http ?? defaultConfig.http,
    port: cliArgs["port"] ? parseInt(cliArgs["port"], 10) : defaultConfig.port,
    remipInfo: {
      host: cliArgs["remip-host"] ?? defaultConfig.remipServer.host,
      port: cliArgs["remip-port"]
        ? parseInt(cliArgs["remip-port"], 10)
        : defaultConfig.remipServer.port,
    },
    startRemipServer:
      cliArgs["start-remip-server"] ?? defaultConfig.startRemipServer,
  };

  // 5. Optionally start ReMIP server
  if (config.startRemipServer) {
    try {
      const remipInfo = await startReMIPServer();
      config.remipInfo = remipInfo;
      remipLog.info(
        {
          event: "subprocess_ready",
          url: `http://${config.remipInfo.host}:${config.remipInfo.port}`,
        },
        "ReMIP server ready"
      );
    } catch (err) {
      logger.fatal({event: "process_exit", err}, "Could not start ReMIP server.");
      cleanupReMIPProcess();
      logger.flush();
      process.exit(1);
    }
  }

  // 6. 起動ログ（抜粋のみ）
  logger.info(
    {
      event: "server_start",
      http: config.http,
      port: config.port,
      remip_host: config.remipInfo.host,
      remip_port: config.remipInfo.port,
    },
    "server starting"
  );

  // 7. Start transports/servers
  if (config.http) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = await setupMcpServer(transport, config.remipInfo);
    setupAppServer(mcpServer, config.port, transport);
  } else {
    const transport = new StdioServerTransport();
    await setupMcpServer(transport, config.remipInfo);
  }
}

// main
main().catch((err) => {
  logger.fatal({event: "exit", err}, "An unexpected error occurred in main");
  logger.flush();
  process.exit(1);
});
