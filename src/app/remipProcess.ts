// src/remip-process.ts
import { ChildProcess, spawn } from 'child_process';
import { Logger } from 'pino';

export interface ReMIPInfo {
  host: string;
  port: number;
}

let remipProcess: ChildProcess | null = null;

export function startReMIPServer(logger: Logger): Promise<ReMIPInfo> {
  return new Promise((resolve, reject) => {
    const command = 'uvx';
    const args = ['remip'];
    logger.info(
      { event: 'subprocess_spawn', command, args },
      `Executing: ${command} ${args.join(' ')}`,
    );

    remipProcess = spawn(command, args, {
      detached: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let resolved = false;

    remipProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      logger.info(
        { event: 'subprocess_output', stream: 'stdout', output },
        'ReMIP server stdout',
      );
    });

    remipProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      logger.info(
        { event: 'subprocess_output', stream: 'stderr', line: output },
        'ReMIP server stderr',
      );

      if (!resolved) {
        const match = output.match(/running on http:\/\/(\S+):(\d+)/i);
        if (match?.[1] && match?.[2]) {
          resolved = true;
          resolve({ host: match[1], port: parseInt(match[2], 10) });
        }
      }
    });

    remipProcess.on('close', (code) => {
      if (code === 0) {
        logger.info(
          { event: 'subprocess_exit', code },
          `ReMIP server process exited with code ${code}`,
        );
      } else {
        logger.fatal(
          { event: 'subprocess_exit', code },
          `ReMIP server process exited with code ${code}`,
        );
      }
      if (!resolved) {
        // まだ起動情報を返せていない場合は reject
        reject(new Error(`ReMIP server exited before ready (code ${code})`));
      }
    });

    remipProcess.on('error', (err) => {
      logger.fatal({ event: 'subprocess_error', err }, 'spawn error');
      if (!resolved) reject(err);
    });
  });
}

export function cleanupReMIPProcess(logger: Logger) {
  if (remipProcess && !remipProcess.killed && remipProcess.pid) {
    logger.info(
      { event: 'subprocess_terminate', pid: remipProcess.pid },
      `Terminating ReMIP server process (PID: ${remipProcess.pid})`,
    );
    try {
      remipProcess.kill('SIGTERM');
    } catch (err) {
      logger.error(
        { event: 'subprocess_terminate_failed', err },
        'Process kill failed',
      );
    }
  }
}
