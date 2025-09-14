import { jest } from '@jest/globals';
import { ReMIPClient } from '../../../src/connectors/remip/ReMIPClient.js';
import { Problem } from '../../../src/connectors/remip/types.js';
import { MipSolution } from '../../../src/schemas/solutions.js';
import { Logger } from 'pino';

describe('ReMIPClient', () => {
  let remipClient: ReMIPClient;
  let mockFetch: jest.SpiedFunction<typeof global.fetch>;
  const baseUrl = 'http://localhost:8000';
  const mockLogger: Logger = {
    info: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
  } as unknown as Logger;

  const mockProblem: Problem = {
    objective: { name: 'Objective', coefficients: [] },
    constraints: [],
    variables: [],
    parameters: { name: 'Problem', sense: -1 },
  };

  beforeEach(() => {
    mockFetch = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    mockFetch.mockRestore();
  });

  describe('solve (non-streaming)', () => {
    beforeEach(() => {
      // stream を private readonly で直接書き換えられないため、非streaming用に新たにインスタンスを作成
      remipClient = new ReMIPClient({
        baseUrl,
        logger: mockLogger,
        stream: false,
      });
    });

    it('should call fetch with the correct URL and timeout parameter when provided', async () => {
      const mockSolution: MipSolution = {
        status: 'optimal',
        objective_value: 10,
        variables: {},
        name: 'test',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn<() => Promise<MipSolution>>()
          .mockResolvedValue(mockSolution),
      } as unknown as Response);

      await remipClient.solve(mockProblem, 60);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/solve?timeout=60`,
        expect.any(Object),
      );
    });

    it('should call fetch with the correct URL without timeout parameter when not provided', async () => {
      const mockSolution: MipSolution = {
        status: 'optimal',
        objective_value: 10,
        variables: {},
        name: 'test',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn<() => Promise<MipSolution>>()
          .mockResolvedValue(mockSolution),
      } as unknown as Response);

      await remipClient.solve(mockProblem);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/solve?`,
        expect.any(Object),
      );
    });

    it('should return the solution when status is timeout', async () => {
      const mockSolution: MipSolution = {
        status: 'timeout',
        objective_value: 5,
        variables: {},
        name: 'test',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn<() => Promise<MipSolution>>()
          .mockResolvedValue(mockSolution),
      } as unknown as Response);

      const result = await remipClient.solve(mockProblem, 30);
      expect(result).toEqual(mockSolution);
    });
  });

  describe('solve (streaming)', () => {
    beforeEach(() => {
      remipClient = new ReMIPClient({
        baseUrl,
        logger: mockLogger,
        stream: true,
      });
    });

    it('should call fetch with the correct URL and timeout parameter when provided', async () => {
      const mockSolution: MipSolution = {
        status: 'optimal',
        objective_value: 10,
        variables: {},
        name: 'test',
      };
      // For streaming, we'll mock the fetch to return a response that resolves to the final JSON
      // This avoids complex ReadableStream mocking issues.
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn<() => Promise<MipSolution>>()
          .mockResolvedValue(mockSolution),
      } as unknown as Response);

      await remipClient.solve(mockProblem, 60);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/solve?stream=sse&timeout=60`,
        expect.any(Object),
      );
    });

    it('should call fetch with the correct URL without timeout parameter when not provided', async () => {
      const mockSolution: MipSolution = {
        status: 'optimal',
        objective_value: 10,
        variables: {},
        name: 'test',
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest
          .fn<() => Promise<MipSolution>>()
          .mockResolvedValue(mockSolution),
      } as unknown as Response);

      await remipClient.solve(mockProblem);

      expect(mockFetch).toHaveBeenCalledWith(
        `${baseUrl}/solve?stream=sse`,
        expect.any(Object),
      );
    });

    it('should return the solution when status is timeout', async () => {
      const enc = new TextEncoder();

      // 最終解の SSE（もしくは "end" に解を含める運用ならそれに合わせる）
      const ssePayload =
        'event: result\n' +
        'data: {"status":"timeout","objective_value":5,"variables":{},"name":"test"}\n\n' +
        'event: end\n' +
        'data: {}\n\n';

      const body = new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(ssePayload));
          controller.close();
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        // streaming では body を読むので json は不要（あっても使われない）
        body,
        headers: new Headers({ 'Content-Type': 'text/event-stream' }),
      } as unknown as Response);

      const result = await remipClient.solve(mockProblem, 30);
      expect(result).toEqual({
        status: 'timeout',
        objective_value: 5,
        variables: {},
        name: 'test',
      });
    });
  });
});
