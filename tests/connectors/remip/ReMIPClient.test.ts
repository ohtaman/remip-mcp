import { ReMIPClient } from '../../../src/connectors/remip/ReMIPClient';
import { jest } from '@jest/globals';
import { Problem } from '../../../src/connectors/remip/types';

// Mock the global fetch function
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  fatal: jest.fn(),
  trace: jest.fn(),
  child: jest.fn(() => mockLogger),
};

const mockProblem: Problem = {
  objective: { name: 'Objective', coefficients: [] },
  constraints: [],
  variables: [],
  parameters: { name: 'TestProblem', sense: -1 },
};

// Helper to create a ReadableStream from an array of strings
function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('ReMIPClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should emit "log" and "metric" events instead of logging them', async () => {
    const sseChunks = [
      'event: log\n',
      'data: {"timestamp": "2025-01-01T12:00:00Z", "message": "Log message"}\n\n',
      'event: metric\n',
      'data: {"timestamp": "2025-01-01T12:00:01Z", "iteration": 1, "objective_value": 100, "gap": 0.1}\n\n',
      'event: result\n',
      'data: {"solution": {"status": "optimal"}}\n\n',
    ];
    const sseStream = createStream(sseChunks);

    mockFetch.mockImplementation(() =>
      Promise.resolve({
        ok: true,
        body: sseStream,
      } as Response),
    );

    const remipClient = new ReMIPClient({ logger: mockLogger });

    const logListener = jest.fn();
    const metricListener = jest.fn();
    remipClient.on('log', logListener);
    remipClient.on('metric', metricListener);

    await remipClient.solve(mockProblem);

    // Check that logger was NOT used for stream events
    expect(mockLogger.info).not.toHaveBeenCalled();

    // Check that events were emitted
    expect(logListener).toHaveBeenCalledTimes(1);
    expect(logListener).toHaveBeenCalledWith({
      timestamp: '2025-01-01T12:00:00Z',
      message: 'Log message',
    });

    expect(metricListener).toHaveBeenCalledTimes(1);
    expect(metricListener).toHaveBeenCalledWith({
      timestamp: '2025-01-01T12:00:01Z',
      iteration: 1,
      objective_value: 100,
      gap: 0.1,
    });
  });
});
