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
  // T002
  it('should define a model with valid code and sample data', async () => {
    const params = {
      model_name: modelName,
      model_code: validModelCode,
      sample_data: { n: 10 },
    };

    const result = await defineModel(sessionId, params, {
      storageService,
      pyodideRunner,
    });

    expect(result.status).toBe('ok');
    expect(pyodideRunner.run).toHaveBeenCalledWith(
      sessionId,
      expect.any(String), // PRE_PROCESS_SCRIPT
      { globals: { sample_data: { n: 10 } } },
    );
    expect(pyodideRunner.run).toHaveBeenCalledWith(
      sessionId,
      validModelCode,
      { globals: { n: 10 } },
    );
  });

  // T003
  it('should handle tuple-keyed dictionaries in sample data', async () => {
    const modelCodeWithTupleKey = `
import pulp
prob = pulp.LpProblem("test_problem")
x = pulp.LpVariable("x", 0, 1)
prob += x * my_dict[ ('a', 'b')]
`;
    const params = {
      model_name: modelName,
      model_code: modelCodeWithTupleKey,
      sample_data: { my_dict: "{ ('a', 'b'): 1}" },
    };

    await defineModel(sessionId, params, { storageService, pyodideRunner });

    expect(pyodideRunner.run).toHaveBeenCalledWith(
      sessionId,
      expect.stringContaining('ast.literal_eval'),
      expect.any(Object),
    );
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
    ).rejects.toThrow('Invalid Python syntax in model code');
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
  it('should throw a runtime error if sample data is invalid', async () => {
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
      sample_data: { y: [1, 2] },
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow('Error executing model with sample data');
  });

  // T105
  it('should throw an error for invalid literal string in sample data', async () => {
    pyodideRunner.run.mockRejectedValue(new Error('ValueError'));

    const params = {
      model_name: modelName,
      model_code: validModelCode,
      sample_data: { my_dict: 'not a valid dict' },
    };

    await expect(
      defineModel(sessionId, params, { storageService, pyodideRunner }),
    ).rejects.toThrow('Failed to parse string literal');
  });
});