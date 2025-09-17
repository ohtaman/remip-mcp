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
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result: any = await solveProblem(sessionId, params, {
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

    expect(result.isError).toBe(false);
    expect(result.summary?.status).toBe('optimal');
  });

  it('should handle infeasible solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result: any = await solveProblem(sessionId, params, {
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

    expect(result.isError).toBe(false);
    expect(result.summary?.status).toBe('infeasible');
    expect(result.summary?.objective_value).toBe(0);
  });

  it('should handle unbounded solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result: any = await solveProblem(sessionId, params, {
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

    expect(result.isError).toBe(false);
    expect(result.summary?.status).toBe('unbounded');
    expect(result.summary?.objective_value).toBe(Infinity);
  });

  it('should handle timelimit solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result: any = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({
        status: 'timeout',
        objective_value: 100,
        variables: {},
        name: 'test',
      }),
      sendNotification: async () => {},
    });

    expect(result.isError).toBe(false);
    expect(result.summary?.status).toBe('timeout');
    expect(result.summary?.objective_value).toBe(100);
  });

  it('should handle not solved solutions correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result: any = await solveProblem(sessionId, params, {
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

    expect(result.isError).toBe(false);
    expect(result.summary?.status).toBe('not solved');
    expect(result.summary?.objective_value).toBe(null);
  });

  it('should correctly preprocess data with tuple-keyed dictionaries', async () => {
    const fakeStorage = new StorageService();
    const modelWithTupleKey = { ...model, code: "prob += my_dict[ ('a', 'b')]" };
    fakeStorage.setModel(sessionId, modelWithTupleKey);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
      getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
    } as unknown as PyodideRunner;

    const params = {
      model_name: 'my_model',
      data: { my_dict: "{ ('a', 'b'): 1}" },
    };

    await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: createMockRemipClient({ status: 'optimal' }),
      sendNotification: async () => {},
    });

    expect(fakePyodideRunner.run).toHaveBeenCalledWith(
      sessionId,
      expect.stringContaining('ast.literal_eval'),
      expect.any(Object),
    );
  });

  describe('Notifications', () => {
    it('should send enriched log notifications on success', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);

      const discoveryResult = { problem: mockProblem, error: null };
      const fakePyodideRunner = {
        run: jest.fn().mockResolvedValue(JSON.stringify(discoveryResult)),
        getOutput: jest.fn().mockReturnValue({ stdout: '', stderr: '' }),
      } as unknown as PyodideRunner;

      const mockRemipClient = createMockRemipClient({});
      const solutionStatus = 'optimal';
      mockRemipClient.solve = jest.fn().mockImplementation(async () => {
        mockRemipClient.emit('log', { message: 'Solver log 1' });
        return {
          objective_value: 123,
          variables: { x: 1 },
          status: solutionStatus,
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
        params: { progress: -1, message: '[Solver] Solver log 1' },
      });
      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'progress',
        params: {
          progress: 1.0,
          message: expect.stringContaining(solutionStatus),
        },
      });
      expect(mockSendNotification).toHaveBeenCalledTimes(4);
    });

    it('should return an error object on failure', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);

      const fakePyodideRunner = {
        run: jest.fn().mockRejectedValue(new Error('Python Error')),
        getOutput: jest
          .fn()
          .mockReturnValue({ stdout: 'test stdout', stderr: 'test stderr' }),
      } as unknown as PyodideRunner;

      const mockSendNotification = jest.fn();

      const params = { model_name: 'my_model', data: {} };

      const result = await solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: fakePyodideRunner,
        remipClient: createMockRemipClient({}),
        sendNotification: mockSendNotification,
      });

      expect(result.isError).toBe(true);
      expect(result.summary).toBeNull();
      expect(result.stdout).toBe('test stdout');
      expect(result.stderr).toContain('test stderr');

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'error',
        params: {
          message: 'Python Error',
          stdout: 'test stdout',
          stderr: 'test stderr',
        },
      });
    });

    it('should return a formatted error object for Python errors', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);
      const pythonErrorMessage = `
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
TypeError: must be real number, not str
`;
      const pythonError = {
        type: 'PythonError',
        message: pythonErrorMessage,
      };

      const fakePyodideRunner = {
        run: jest.fn().mockRejectedValue(pythonError),
        getOutput: jest
          .fn()
          .mockReturnValue({ stdout: 'test stdout', stderr: 'test stderr' }),
      } as unknown as PyodideRunner;

      const mockSendNotification = jest.fn();

      const params = { model_name: 'my_model', data: {} };

      const result = await solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: fakePyodideRunner,
        remipClient: createMockRemipClient({}),
        sendNotification: mockSendNotification,
      });

      expect(result.isError).toBe(true);
      expect(result.summary).toBeNull();
      expect(result.stderr).toContain(
        'TypeError: must be real number, not str',
      );

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'error',
        params: {
          message:
            'Error in Python model: TypeError: must be real number, not str',
          stdout: 'test stdout',
          stderr: 'test stderr',
        },
      });
    });
    it('should return a formatted error object for ZeroDivisionError', async () => {
      const fakeStorage = new StorageService();
      fakeStorage.setModel(sessionId, model);

      const pythonErrorMessage = `
Traceback (most recent call last):
  File "<stdin>", line 1, in <module>
ZeroDivisionError: division by zero
`;
      const pythonError = {
        type: 'PythonError',
        message: pythonErrorMessage,
      };

      const fakePyodideRunner = {
        run: jest.fn().mockRejectedValue(pythonError),
        getOutput: jest
          .fn()
          .mockReturnValue({ stdout: 'test stdout', stderr: 'test stderr' }),
      } as unknown as PyodideRunner;

      const mockSendNotification = jest.fn();

      const params = { model_name: 'my_model', data: {} };

      const result = await solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: fakePyodideRunner,
        remipClient: createMockRemipClient({}),
        sendNotification: mockSendNotification,
      });

      expect(result.isError).toBe(true);
      expect(result.summary).toBeNull();
      expect(result.stderr).toContain('division by zero');

      expect(mockSendNotification).toHaveBeenCalledWith({
        method: 'error',
        params: {
          message:
            'Error in Python model: A division by zero occurred. Please check your model for calculations that might result in division by zero.',
          stdout: 'test stdout',
          stderr: 'test stderr',
        },
      });
    });
  });
});
