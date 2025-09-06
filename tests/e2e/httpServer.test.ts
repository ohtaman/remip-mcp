import { jest } from '@jest/globals';
import { spawn, ChildProcess } from 'child_process';
import fetch from 'cross-fetch';

jest.setTimeout(30000);

describe('HTTP Server End-to-End', () => {
  let serverProcess: ChildProcess;
  let baseUrl: string;

  beforeEach(async () => {
    serverProcess = spawn('node', ['dist/index.js', '--http', '--port', '0'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Wait for the server to be ready
    await new Promise<void>((resolve) => {
      serverProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        const match = output.match(
          /Application server listening at http:\/\/localhost:(\d+)/,
        );
        if (match) {
          const port = parseInt(match[1], 10);
          baseUrl = `http://localhost:${port}`;
          resolve();
        }
      });
    });
  });

  afterEach(() => {
    serverProcess.kill('SIGKILL');
  });

  it('should not crash if client disconnects', async () => {
    let serverCrashed = false;
    serverProcess.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        serverCrashed = true;
      }
    });

    const controller = new AbortController();
    const signal = controller.signal;

    const solvePromise = fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/solve_mip_problem',
        params: { problemId: 'test-problem' },
        id: 1,
      }),
      signal,
    });

    // Simulate the client disconnecting almost immediately
    setTimeout(() => {
      controller.abort();
    }, 50);

    await expect(solvePromise).rejects.toThrow();

    // Wait a bit to see if the server crashes
    await new Promise((resolve) => setTimeout(resolve, 500));

    // The server process should NOT have crashed
    expect(serverCrashed).toBe(false);
  });
});
