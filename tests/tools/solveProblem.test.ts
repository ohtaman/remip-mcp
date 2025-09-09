import { solveProblem } from '../../src/tools/solveProblem.js';
import { StorageService } from '../../src/app/storage.js';
import { Model } from '../../src/schemas/models.js';
import { Solution } from '../../src/schemas/solutions.js';
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

  const fakeRemipClient = {
    solve: jest.fn().mockResolvedValue({
      objectiveValue: 123,
      variableValues: { x: 1 },
      status: 'optimal',
    } as Solution),
  } as unknown as ReMIPClient;

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
      remipClient: fakeRemipClient,
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

    // infeasibleなソリューションを返すReMIPクライアント
    const infeasibleRemipClient = {
      solve: jest.fn().mockResolvedValue({
        objectiveValue: 0,
        variableValues: {},
        status: 'infeasible',
      } as Solution),
    } as unknown as ReMIPClient;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: infeasibleRemipClient,
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

    const unboundedRemipClient = {
      solve: jest.fn().mockResolvedValue({
        objectiveValue: Infinity,
        variableValues: {},
        status: 'unbounded',
      } as Solution),
    } as unknown as ReMIPClient;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: unboundedRemipClient,
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

    const timelimitRemipClient = {
      solve: jest.fn().mockResolvedValue({
        objectiveValue: 100,
        variableValues: { x: 5 },
        status: 'timelimit',
      } as Solution),
    } as unknown as ReMIPClient;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: timelimitRemipClient,
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

    const notSolvedRemipClient = {
      solve: jest.fn().mockResolvedValue({
        objectiveValue: null,
        variableValues: {},
        status: 'not solved',
      } as Solution),
    } as unknown as ReMIPClient;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: notSolvedRemipClient,
      sendNotification: async () => {},
    });

    expect(result.status).toBe('not solved');
    expect(result.objective_value).toBe(null);
  });
});
