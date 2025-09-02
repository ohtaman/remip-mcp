import { generateMipProblem } from '../../src/tools/generateMipProblem';
import { PyodideRunner } from '../../src/app/pyodideRunner';
import { StorageService } from '../../src/app/storage';

// Mock the dependencies
jest.mock('../../src/app/pyodideRunner');
jest.mock('../../src/app/storage');

describe('generateMipProblem', () => {
  let pyodideRunner: jest.Mocked<PyodideRunner>;
  let storageService: jest.Mocked<StorageService>;
  let mockPyodide: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    pyodideRunner = new PyodideRunner() as jest.Mocked<PyodideRunner>;
    storageService = new StorageService() as jest.Mocked<StorageService>;

    // Mock the Pyodide instance and its methods
    mockPyodide = {
      runPython: jest.fn(),
      loadPackage: jest.fn().mockResolvedValue(undefined),
      pyimport: jest.fn().mockReturnValue({ install: jest.fn().mockResolvedValue(undefined) }),
      globals: {
        get: jest.fn(),
      },
    };
    pyodideRunner.getPyodide.mockResolvedValue(mockPyodide);
  });

  it('should find one LpProblem, serialize it, store it, and return a problemId', async () => {
    const sessionId = 'session-123';
    const problemDefinitionCode = 'import pulp; my_problem = pulp.LpProblem("TestProblem")';
    const problemDict = { objective: {}, constraints: [], variables: [], parameters: {} };

    // Simulate the script execution and problem finding
    mockPyodide.runPython.mockImplementation((script: string) => {
      if (script.includes('__problem_names__')) {
        // This is the finder script
        const problemNamesProxy = {
          toJs: () => ['my_problem'],
          destroy: jest.fn(),
        };
        mockPyodide.globals.get.mockReturnValueOnce(problemNamesProxy);
      } else if (script.includes('json.dumps')) {
        // This is the serialization script
        return JSON.stringify(problemDict);
      }
    });

    const result = await generateMipProblem(sessionId, { problemDefinitionCode }, { pyodideRunner, storageService });

    // Verify the calls
    expect(pyodideRunner.getPyodide).toHaveBeenCalledWith(sessionId);
    expect(mockPyodide.runPython).toHaveBeenCalledWith(problemDefinitionCode);
    expect(mockPyodide.runPython).toHaveBeenCalledWith(expect.stringContaining('isinstance(var, pulp.LpProblem)'));
    expect(mockPyodide.runPython).toHaveBeenCalledWith(expect.stringContaining('json.dumps(my_problem.toDict())'));
    expect(storageService.set).toHaveBeenCalledWith(sessionId, expect.any(String), problemDict);
    expect(result).toHaveProperty('problemId');
    expect(typeof result.problemId).toBe('string');
  });

  it('should throw an error if no LpProblem instance is found', async () => {
    const sessionId = 'session-456';
    const problemDefinitionCode = 'a = 1; b = 2';

    // Simulate the finder script returning an empty list
    const problemNamesProxy = {
      toJs: () => [],
      destroy: jest.fn(),
    };
    mockPyodide.globals.get.mockReturnValue(problemNamesProxy);

    await expect(
      generateMipProblem(sessionId, { problemDefinitionCode }, { pyodideRunner, storageService })
    ).rejects.toThrow('No pulp.LpProblem instance was found in the Python script. Please define one.');
  });

  it('should throw an error if multiple LpProblem instances are found', async () => {
    const sessionId = 'session-789';
    const problemDefinitionCode = 'import pulp; p1 = pulp.LpProblem(); p2 = pulp.LpProblem()';

    // Simulate the finder script returning multiple names
    const problemNamesProxy = {
      toJs: () => ['p1', 'p2'],
      destroy: jest.fn(),
    };
    mockPyodide.globals.get.mockReturnValue(problemNamesProxy);

    await expect(
      generateMipProblem(sessionId, { problemDefinitionCode }, { pyodideRunner, storageService })
    ).rejects.toThrow('Multiple pulp.LpProblem instances found: [p1, p2]. Please define only one.');
  });
});