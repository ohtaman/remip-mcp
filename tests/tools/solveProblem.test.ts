import { solveProblem } from '../../src/tools/solveProblem';
import { StorageService } from '../../src/app/storage';
import { Model } from '../../src/schemas/models';
import { Solution } from '../../src/schemas/solutions';
import { Problem } from '../../src/connectors/remip/types';

describe('solveProblem Tool', () => {
  const sessionId = 'test-session';
  const model: Model = {
    name: 'my_model',
    code: '... code ...',
    type: 'pulp.LpProblem',
    inputs: ['a', 'b'],
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
  };

  it('should return an error if input data keys do not match model inputs', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);
    const params = { model_name: 'my_model', data: { a: 1 } }; // Missing 'b'

    await expect(
      solveProblem(sessionId, params, {
        storageService: fakeStorage,
        pyodideRunner: {} as any,
        remipClient: {} as any,
        sendNotification: async () => {},
      }),
    ).rejects.toThrow('Input data does not match model inputs');
  });

  it('should execute successfully and call dependencies correctly', async () => {
    const fakeStorage = new StorageService();
    fakeStorage.setModel(sessionId, model);

    const fakePyodideRunner = {
      run: jest.fn().mockResolvedValue(JSON.stringify(mockProblem)),
    };

    const params = {
      model_name: 'my_model',
      data: { a: 1, b: 2 },
    };

    const result = await solveProblem(sessionId, params, {
      storageService: fakeStorage,
      pyodideRunner: fakePyodideRunner as any,
      remipClient: fakeRemipClient as any,
      sendNotification: async () => {},
    });

    // Verify the runner was called once with the combined code
    expect(fakePyodideRunner.run).toHaveBeenCalledTimes(1);
    const executionCode = fakePyodideRunner.run.mock.calls[0][1];
    expect(executionCode).toContain(model.code);
    expect(executionCode).toContain('isinstance(v, pulp.LpProblem)');

    // Verify the solver was called with the result
    expect(fakeRemipClient.solve).toHaveBeenCalledWith(mockProblem);
    
    // Verify the result
    expect(result.status).toBe('Optimal');
    expect(result.objective_value).toBe(123);
  });
});
