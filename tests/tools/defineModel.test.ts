import { defineModel } from '../../src/tools/defineModel.js';
import { StorageService } from '../../src/app/storage.js';
import { PyodideRunner } from '../../src/app/pyodideRunner.js';

describe('defineModel Tool', () => {
  const sessionId = 'test-session';
  const modelName = 'my_model';
  const validModelCode = `
import pulp
prob = pulp.LpProblem("test_problem")
x = pulp.LpVariable("x", 0, 1)
prob += x
`;

  let storageService: StorageService;
  let pyodideRunner: jest.Mocked<PyodideRunner>;

  beforeEach(() => {
    storageService = new StorageService();
    pyodideRunner = {
      run: jest.fn().mockResolvedValue(undefined),
      getOutput: jest.fn().mockReturnValue({ stdout: '1', stderr: '' }),
    } as unknown as jest.Mocked<PyodideRunner>;
  });

  // T001
  it('should define a model with valid code and no sample data', async () => {
    const params = {
      model_name: modelName,
      model_code: validModelCode,
    };

    const result = await defineModel(sessionId, params, {
      storageService,
      pyodideRunner,
    });

    expect(result.status).toBe('ok');
    expect(result.model_name).toBe(modelName);
    const model = storageService.getModel(sessionId, modelName);
    expect(model).toBeDefined();
    expect(model?.name).toBe(modelName);
    expect(model?.code).toBe(validModelCode);
  });

  // T101
  it('should throw a syntax error for invalid model code', async () => {
    const invalidModelCode = 'x =';
    pyodideRunner.run.mockRejectedValue(new Error('SyntaxError'));

    const params = {
      model_name: modelName,
      model_code: invalidModelCode,
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow('Error executing model: SyntaxError');
  });

  // T102
  it('should throw an error if no LpProblem instance is found', async () => {
    const codeWithoutProblem = 'x = 1';
    pyodideRunner.getOutput.mockReturnValue({ stdout: '0', stderr: '' });

    const params = {
      model_name: modelName,
      model_code: codeWithoutProblem,
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow('No pulp.LpProblem instance found');
  });

  // T103
  it('should throw an error if multiple LpProblem instances are found', async () => {
    const codeWithMultipleProblems = `
import pulp
p1 = pulp.LpProblem()
p2 = pulp.LpProblem()
`;
    pyodideRunner.getOutput.mockReturnValue({ stdout: '2', stderr: '' });

    const params = {
      model_name: modelName,
      model_code: codeWithMultipleProblems,
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow('Multiple pulp.LpProblem instances found');
  });

  // T104
  it('should throw a runtime error for invalid model code', async () => {
    const modelCode = `
import pulp
prob = pulp.LpProblem()
prob += x[0]
`;
    pyodideRunner.run.mockImplementation(async (sid, code, options) => {
      if (code.includes('prob += x[0]')) {
        throw new Error('NameError: name "x" is not defined');
      }
      return undefined;
    });

    const params = {
      model_name: modelName,
      model_code: modelCode,
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow(
      'Error executing model: NameError: name "x" is not defined',
    );
  });
});
