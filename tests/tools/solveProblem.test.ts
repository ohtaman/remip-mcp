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
});
