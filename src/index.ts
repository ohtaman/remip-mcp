import { parseArgs } from "node:util";
import express from "express";
import { spawn } from 'child_process';
// ステップ2で作成した設定ファイルをインポート
import { defaultConfig } from './config.js';

interface ReMIPInfoSchema {
    host: string;
    port: number;
}

function startReMIPServer(): Promise<ReMIPInfoSchema> {
    return new Promise((resolve, reject) => {
        const command = "uvx";
        const args = ["--from=git+https://github.com/ohtaman/remip.git#subdirectory=remip", "remip"];
        console.log(`Executing: ${command} ${args.join(' ')}`);

        const remipProcess = spawn(command, args);

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

        remipProcess.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`ReMIP server process exited with code ${code}`));
            }
        });
    });
}


async function main() {
    // 1. コマンドラインオプションを定義 (config.tsのキーと対応させる)
    const options = {
        'port': { type: 'string' },
        'remip-host': { type: 'string' },
        'remip-port': { type: 'string' },
        'start-remip-server': { type: 'boolean' },
        'help': { type: 'boolean', short: 'h' }
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
  --port <port>           Port for this application server (Default: ${defaultConfig.port})
  --remip-host <host>         Hostname of the ReMIP server (Default: ${defaultConfig.remipServer.host})
  --remip-port <port>         Port of the ReMIP server (Default: ${defaultConfig.remipServer.port})
  --start-remip-server        Start a local ReMIP server on launch (Default: ${defaultConfig.startRemipServer})
  -h, --help                  Show this help message
`);
        return;
    }

    // 3. 設定のマージ (デフォルト設定をコマンドライン引数で上書き)
    const finalConfig = {
        appPort: cliArgs['port'] ? parseInt(cliArgs['port'], 10) : defaultConfig.port,
        remipHost: cliArgs['remip-host'] ?? defaultConfig.remipServer.host,
        remipPort: cliArgs['remip-port'] ? parseInt(cliArgs['remip-port'], 10) : defaultConfig.remipServer.port,
        startRemipServer: cliArgs['start-remip-server'] ?? defaultConfig.startRemipServer,
    };

    // 4. 必要であればReMIPサーバーを起動し、設定を動的に更新
    if (finalConfig.startRemipServer) {
        try {
            const remipInfo = await startReMIPServer();
            // サーバーから取得した情報でホストとポートを上書き
            finalConfig.remipHost = remipInfo.host;
            finalConfig.remipPort = remipInfo.port;
            console.log(`ReMIP server started and is now targeted at http://${finalConfig.remipHost}:${finalConfig.remipPort}`);
        } catch (error) {
            console.error("Could not start ReMIP server:", error);
            process.exit(1);
        }
    }

    console.log("Using final configuration:", finalConfig);

    // 5. 確定した設定値を使ってExpressサーバーを起動
    const app = express();
    app.use(express.json());

    app.get("/health", async (req, res) => {
        console.log("Health check successful");
        res.json({ 
            status: "ok",
            remipTarget: `http://${finalConfig.remipHost}:${finalConfig.remipPort}`
        });
    });

    app.listen(finalConfig.appPort, () => {
        console.log(`Application server listening at http://localhost:${finalConfig.appPort}`);
    });
}

// main関数を実行
main().catch(error => {
    console.error("An unexpected error occurred in main:", error);
    process.exit(1);
});
