import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ChildProcess, spawn } from "child_process";
import express from "express";
import { parseArgs } from "node:util";
import { z } from "zod";
import { defaultConfig } from "./config.js";

interface ReMIPInfo {
  host: string;
  port: number;
}

// Global variable to track the ReMIP process
let remipProcess: ChildProcess | null = null;

function startReMIPServer(): Promise<ReMIPInfo> {
  return new Promise((resolve, reject) => {
    const command = "uvx";
    const args = [
      "--from=git+https://github.com/ohtaman/remip.git#subdirectory=remip",
      "remip",
    ];
    console.log(`Executing: ${command} ${args.join(" ")}`);

    remipProcess = spawn(command, args, {
      // Create new process group for proper cleanup
      detached: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    remipProcess.stdout?.on("data", (data) => {
      console.error(`[ReMIP Server]: ${data.toString()}`);
    });

    remipProcess.stderr?.on("data", (data) => {
      const output = data.toString();
      console.log(`[ReMIP Server]: ${output}`); // ログを出力
      const match = output.match(/running on http:\/\/(\S+):(\d+)/);
      if (match && match[1] && match[2]) {
        resolve({ host: match[1], port: parseInt(match[2], 10) });
      }
    });

    remipProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ReMIP server process exited with code ${code}`));
      }
    });
  });
}

// Function to clean up the ReMIP process and all its children
function cleanupReMIPProcess() {
  if (remipProcess && !remipProcess.killed && remipProcess.pid) {
    console.log(
      `Terminating ReMIP server process tree (PID: ${remipProcess.pid})...`
    );

    try {
      remipProcess.kill("SIGTERM");
    } catch (killError) {
      console.log("process kill also failed:", killError);
    }
  }
}

// Set up signal handlers to clean up the ReMIP process
function setupSignalHandlers() {
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];

  signals.forEach((signal) => {
    process.on(signal, () => {
      console.log(`Received ${signal}, cleaning up...`);
      cleanupReMIPProcess();
      process.exit(0);
    });
  });

  // Handle uncaught exceptions and unhandled rejections
  process.on("uncaughtException", (error) => {
    console.error("Uncaught exception:", error);
    cleanupReMIPProcess();
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    cleanupReMIPProcess();
    process.exit(1);
  });
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
          ),
        timeLimit: z
          .number()
          .describe(
            "The time limit in seconds. If not specified, the default time limit 3600 seconds will be used."
          ),
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
            objective: z
              .number()
              .describe("The objective value of the solution."),
            variables: z.object({
              name: z.string().describe("The name of the variable."),
              value: z.number().describe("The value of the variable."),
            }),
          })
          .nullable(),
        error_message: z
          .string()
          .describe("The error message of the solution.")
          .nullable(),
        logs: z
          .array(z.string())
          .describe(
            "The logs of the solution. The logs are the output of the MIP solver."
          )
          .nullable(),
      },
    },
    async ({ code }) => {
      return {
        structuredContent: {
          status: "not_solved",
          solution: null,
          error_message: null,
          logs: null,
        },
        content: [
          {
            type: "text",
            text: "Solving the problem...",
          },
        ],
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
  // 5. 確定した設定値を使ってExpressサーバーを起動
  const app = express();
  app.use(express.json());

  app.get("/health", async (req, res) => {
    console.log("Health check successful");
    res.status(200).end();
  });

  app.post("/mcp", async (req, res) => {
    try {
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: {
            // JSON-RPC 2.0のエラーコードを指定
            // http://www.jsonrpc.org/specification#error_object
            code: -32603,
            message: "Internal server error",
          },
          id: null,
        });
      }
    }
  });

  app.get("/mcp", async (req, res) => {
    console.log("Received GET MCP request");
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed.",
        },
        id: null,
      })
    );
  });

  app.listen(port, () => {
    console.log(`Application server listening at http://localhost:${port}`);
  });
}

async function main() {
  // Set up signal handlers first
  setupSignalHandlers();

  // 1. コマンドラインオプションを定義 (config.tsのキーと対応させる)
  const options = {
    http: { type: "boolean" },
    port: { type: "string" },
    "remip-host": { type: "string" },
    "remip-port": { type: "string" },
    "start-remip-server": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  } as const;

  // 2. コマンドライン引数をパース
  const { values: cliArgs } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2),
    options: options,
  });

  // ヘルプオプションが指定された場合は使い方を表示して終了
  if (cliArgs.help) {
    console.log(`
Usage: node index.js [options]

Options:
  --http                    Start an HTTP server (Default: ${defaultConfig.http})
  --port <port>           Port for this application server (Default: ${defaultConfig.port})
  --remip-host <host>         Hostname of the ReMIP server (Default: ${defaultConfig.remipServer.host})
  --remip-port <port>         Port of the ReMIP server (Default: ${defaultConfig.remipServer.port})
  --start-remip-server        Start a local ReMIP server on launch (Default: ${defaultConfig.startRemipServer})
  -h, --help                  Show this help message
`);
    return;
  }

  // 3. 設定のマージ (デフォルト設定をコマンドライン引数で上書き)
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

  // 4. 必要であればReMIPサーバーを起動し、設定を動的に更新
  if (config.startRemipServer) {
    try {
      const remipInfo = await startReMIPServer();
      // サーバーから取得した情報でホストとポートを上書き
      config.remipInfo = remipInfo;
      console.log(
        `ReMIP server started and is now targeted at http://${config.remipInfo.host}:${config.remipInfo.port}`
      );
    } catch (error) {
      console.error("Could not start ReMIP server:", error);
      process.exit(1);
    }
  }

  console.log("Using configuration:", JSON.stringify(config));
  if (config.http) {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const mcpServer = await setupMcpServer(transport, config.remipInfo);
    setupAppServer(mcpServer, config.port, transport);
  } else {
    const transport = new StdioServerTransport();
    setupMcpServer(transport, config.remipInfo);
  }
}

// main関数を実行
main().catch((error) => {
  console.error("An unexpected error occurred in main:", error);
  process.exit(1);
});
