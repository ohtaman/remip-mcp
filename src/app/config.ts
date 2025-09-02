import { parseArgs } from "node:util";

export const defaultConfig = {
  // Start an HTTP server
  http: false,

  // Port number for this MCP server
  port: 3000,

  // Information of ReMIP Server
  remipServer: {
    host: "localhost",
    port: 9000,
  },

  // Start local ReMIP Server
  startRemipServer: false,
  // path to the ReMIP Server to start.
  remipSourceURI: "git+https://github.com/ohtaman/remip.git#subdirectory=remip",
  pyodidePackages: ["numpy", "pandas"],
};

export interface AppConfig {
  http: boolean;
  port: number;
  remipInfo: {
    host: string;
    port: number;
  };
  startRemipServer: boolean;
  remipSourceURI: string;
  pyodidePackages: string[];
}

export function processCommandOptions(): AppConfig {
  const options = {
    http: { type: "boolean" },
    port: { type: "string" },
    "remip-host": { type: "string" },
    "remip-port": { type: "string" },
    "start-remip-server": { type: "boolean" },
    "remip-source-uri": { type: "string"},
    "pyodide-packages": { type: "string", multiple: true },
    help: { type: "boolean", short: "h" },
  } as const;

  const { values: cliArgs } = parseArgs({
    allowPositionals: false,
    args: process.argv.slice(2),
    options,
  });

  if (cliArgs.help) {
    process.stdout.write(
      `
Usage: node index.js [options]

Options:
  --http                       Start an HTTP server (Default: ${defaultConfig.http})
  --port <port>                Port for this application server (Default: ${defaultConfig.port})
  --remip-host <host>          Hostname of the ReMIP server to connect to. This option is ignored if --start-remip-server is specified. (Default: ${defaultConfig.remipServer.host})
  --remip-port <port>          Port of the ReMIP server to connect to. This option is ignored if --start-remip-server is specified. (Default: ${defaultConfig.remipServer.port})
  --start-remip-server         Start a local ReMIP server on launch (Default: ${defaultConfig.startRemipServer})
  --remip-source-uri           URL of the source code of the local ReMIP server to start (Default: ${defaultConfig.remipSourceURI})
  --pyodide-packages <package> Packages to install in Pyodide. Can be specified multiple times. (Default: ${defaultConfig.pyodidePackages.join(
    ", "
  )})
  -h, --help                   Show this help message
`.trimStart()
    );
    process.exit(0);
  }

  // Apply default values
  const config = {
    http: cliArgs.http ?? defaultConfig.http,
    port: cliArgs["port"] ? parseInt(cliArgs["port"], 10) : defaultConfig.port,
    remipInfo: {
      host: cliArgs["remip-host"] ?? defaultConfig.remipServer.host,
      port: cliArgs["remip-port"]
        ? parseInt(cliArgs["remip-port"], 10)
        : defaultConfig.remipServer.port,
    },
    startRemipServer: cliArgs["start-remip-server"] ?? defaultConfig.startRemipServer,
    remipSourceURI: cliArgs["remip-source-uri"] ?? defaultConfig.remipSourceURI,
    pyodidePackages: cliArgs["pyodide-packages"] ?? defaultConfig.pyodidePackages,
  };

  return config;
}