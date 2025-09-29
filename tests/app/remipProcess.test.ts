import { startReMIPServer } from '../../src/app/remipProcess.js';
import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import { jest } from '@jest/globals';
import type { Logger } from 'pino';
import type { ChildProcess } from 'child_process';

// Mock the child_process module
jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

const mockedSpawn = spawn as jest.Mock;

// A mock logger that does nothing
const mockLogger = {
  info: () => {},
  error: () => {},
  fatal: () => {},
} as unknown as Logger;

// A more realistic mock for ChildProcess
const createMockProcess = (): ChildProcess => {
  const process = new EventEmitter() as ChildProcess;
  process.stdout = new EventEmitter() as any;
  process.stderr = new EventEmitter() as any;
  return process;
};

describe('startReMIPServer', () => {
  it('should parse the host and port from stderr and resolve with the correct ReMIPInfo', async () => {
    const mockProcess = createMockProcess();
    mockedSpawn.mockReturnValue(mockProcess);

    const serverPromise = startReMIPServer(mockLogger);

    // Simulate the server starting and printing to stderr
    const stderrOutput = [
      'INFO:     Started server process [12345]',
      'INFO:     Waiting for application startup.',
      'INFO:     Application startup complete.',
      'INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)',
    ].join('\n');

    mockProcess.stderr!.emit('data', stderrOutput);

    await expect(serverPromise).resolves.toEqual({
      host: '127.0.0.1',
      port: 8000,
    });
  });

  it('should reject if the process exits with an error before resolving', async () => {
    const mockProcess = createMockProcess();
    mockedSpawn.mockReturnValue(mockProcess);

    const serverPromise = startReMIPServer(mockLogger);

    // Simulate the process closing with an error code
    mockProcess.emit('close', 1);

    await expect(serverPromise).rejects.toThrow(
      'ReMIP server exited before ready (code 1)',
    );
  });
});
