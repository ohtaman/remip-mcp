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
    code: '... code ...',
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
    } as Solution),
  } as unknown as ReMIPClient;

  it('should succeed when discovery script returns a JSON string', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const discoveryResult = { problem: mockProblem, error: null };
    const fakePyodideRunner = {
      run: jest
        .fn()
        .mockResolvedValueOnce(undefined) // User code runs
        .mockResolvedValueOnce(JSON.stringify(discoveryResult)), // Discovery code returns a plain string
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner,
      remipClient: fakeRemipClient,
      sendNotification: async () => {},
    });

    expect(fakePyodideRunner.run).toHaveBeenCalledTimes(2);
    expect(fakeRemipClient.solve).toHaveBeenCalledWith(mockProblem);
    expect(result.status).toBe('Optimal');
  });

  it('should throw a user-friendly error if the model code has a syntax error', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const pythonSyntaxError = new Error(
      'Traceback(...)\nSyntaxError: invalid syntax',
    );
    const fakePyodideRunner = {
      run: jest.fn().mockRejectedValue(pythonSyntaxError),
    } as unknown as PyodideRunner;

    const params = { model_name: 'my_model', data: {} };

    await expect(
      solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: fakePyodideRunner,
        remipClient: fakeRemipClient,
        sendNotification: async () => {},
      }),
    ).rejects.toThrow(
      new RegExp(
        '^An error occurred in the model code execution:.*SyntaxError',
        's',
      ),
    );
  });
});
