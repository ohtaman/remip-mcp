import { EventEmitter } from 'events';
import { solveProblem } from '../../src/tools/solveProblem.js';
import { StorageService } from '../../src/app/storage.js';
import { Model } from '../../src/schemas/models.js';
import { MipSolution } from '../../src/schemas/solutions.js';
import { Problem } from '../../src/connectors/remip/types.js';
import { PyodideRunner } from '../../src/app/pyodideRunner.js';
import { ReMIPClient } from '../../src/connectors/remip/ReMIPClient.js';

describe('solveProblem Tool', () => {
  const sessionId = 'test-session';
  const model: Model = {
    name: 'my_model',
    code: 'x = 1',
    type: 'pulp.LpProblem',
    inputs: [],
  };

  const mockProblem: Problem = {
    objective: { name: 'Objective', coefficients: [] },
    constraints: [],
    variables: [],
    parameters: { name: 'Problem', sense: -1 },
  };

  const createMockRemipClient = (solution: Partial<MipSolution>) => {
    const client = new EventEmitter() as ReMIPClient;
    client.solve = jest.fn().mockResolvedValue(solution);
    return client;
  };

  it('should combine user code and discovery code into a single run', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'optimal',
        objective_value: 0,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(fakePyodideRunner.run).toHaveBeenCalledTimes(1);
    const executedCode = (fakePyodideRunner.run as jest.Mock).mock.calls[0][1];
    expect(executedCode).toContain('x = 1'); // User code
    expect(executedCode).toContain('isinstance(v, pulp.LpProblem)'); // Discovery code
  });

  it('should handle infeasible solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'infeasible',
        objective_value: 0,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(result.status).toBe('infeasible');
    expect(result.objective_value).toBe(0);
  });

  it('should handle unbounded solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'unbounded',
        objective_value: Infinity,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(result.status).toBe('unbounded');
    expect(result.objective_value).toBe(Infinity);
  });

  it('should handle timelimit solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'timelimit',
        objective_value: 100,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(result.status).toBe('timelimit');
    expect(result.objective_value).toBe(100);
  });

  it('should handle not solved solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'not solved',
        objective_value: null,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(result.status).toBe('not solved');
    expect(result.objective_value).toBe(null);
  });

  describe('Notifications', () => {
    it('should send progress and log notifications on success', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);

      const discoveryResult = { problem: mockProblem, error: null };
      const fakePyodideRunner = {
        run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      } as unknown as PyodideRunner;

      const mockRemipClient = createMockRemipClient({});
      mockRemipClient.solve = jest.fn().mockImplementation(async () => {
        mockRemipClient.emit('log', { message: 'Solver log 1' });
        return {
          objective_value: 123,
          variables: { x: 1 },
          status: 'optimal',
          name: 'test',
        };
      });

      const mockSendNotification = jest.fn();

      const params = { model_name: 'my_model', data: {} };

      await solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: fakePyodideRunner,
        remipClient: mockRemipClient,
        sendNotification: mockSendNotification,
      });

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'progress',
        params: { progress: 0, message: 'Starting problem solving...' },
      });
      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'progress',
        params: {
          progress: 0.3,
          message: 'Generating problem from model code...',
        },
      });
      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'log',
        params: { message: '[Solver] Solver log 1' },
      });
      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'progress',
        params: { progress: 1.0, message: 'Problem solved successfully.' },
      });
      expect(mockSendNotification).toHaveBeenCalledTimes(4);
    });

    it('should send an error notification on failure', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);

      const fakePyodideRunner = {
        run: jest.fn().mockRejectedValue(new Error('Python Error')),
      } as unknown as PyodideRunner;

      const mockSendNotification = jest.fn();

      const params = { model_name: 'my_model', data: {} };

      await expect(
        solveProblem(sessionId, params, {
          storageService: fakeStorage,
          pyodideRunner: fakePyodideRunner,
          remipClient: createMockRemipClient({}),
          sendNotification: mockSendNotification,
        }),
      ).rejects.toThrow();

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'error',
        params: { message: 'Python Error' },
      });
    });
  });
});
