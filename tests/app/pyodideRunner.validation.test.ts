import { PyodideRunner } from '../../src/app/pyodideRunner';
import { loadPyodide } from 'pyodide';

// Mock the entire pyodide module
jest.mock('pyodide');

// Type assertion for the mocked function
const mockedLoadPyodide = loadPyodide as jest.Mock;

describe('PyodideRunner Data Validation', () => {
  let runner: PyodideRunner;
  let mockPyodideInstance: any;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup the mock Pyodide instance that will be returned by loadPyodide
    mockPyodideInstance = {
      loadPackage: jest.fn().mockResolvedValue(undefined),
      pyimport: jest
        .fn()
        .mockReturnValue({ install: jest.fn().mockResolvedValue(undefined) }),
      runPythonAsync: jest.fn(), // No default implementation
      setStdout: jest.fn(),
      setStderr: jest.fn(),
      toPy: jest.fn((obj) => obj), // Simple pass-through for mock
      globals: {
        get: jest.fn().mockImplementation((name) => {
          if (name === 'dict') {
            return () => ({ set: jest.fn() });
          }
          return jest.fn();
        }),
        set: jest.fn(),
      },
    };
    mockedLoadPyodide.mockResolvedValue(mockPyodideInstance);

    // Instantiate our runner
    runner = new PyodideRunner('path/to/pyodide');
  });

  it('should throw a specific TypeError if data contains a tuple key', async () => {
    // Arrange: The user provides data that would result in a tuple key in Python.
    const invalidGlobals = {
      costs: { '("P1", "F1")': 10 }, // Simplified representation
    };

    // Arrange: Configure the mock to simulate the Python validation script finding a tuple key.
    mockPyodideInstance.runPythonAsync.mockImplementation(
      async (code: string) => {
        if (code.includes('_validate_data_keys')) {
          const error = new Error(
            "Unsupported key type 'tuple' found in input data.",
          );
          (error as any).type = 'TypeError';
          throw error;
        }
        return 'User script executed';
      },
    );

    // Act & Assert: Expect the run method to throw our custom, user-friendly error.
    await expect(
      runner.run('test-session', 'some_user_code', { globals: invalidGlobals }),
    ).rejects.toThrow(
      "Input data validation failed: Unsupported key type 'tuple' found in input data.",
    );
  });

  it('should run successfully if data is valid', async () => {
    // Arrange: The user provides valid, nested data.
    const validGlobals = {
      costs: { P1: 100, P2: 120 },
      demands: [{ region: 'north', value: 50 }],
    };

    mockPyodideInstance.runPythonAsync.mockResolvedValue('Success');

    // Act & Assert: Expect the run method to complete without throwing.
    await expect(
      runner.run('test-session', 'some_user_code', { globals: validGlobals }),
    ).resolves.not.toThrow();

    // Assert that the validation script was run, and then the user script was run.
    expect(mockPyodideInstance.runPythonAsync).toHaveBeenCalledTimes(2);
    expect(mockPyodideInstance.runPythonAsync.mock.calls[0][0]).toContain(
      '_validate_data_keys',
    );
    expect(mockPyodideInstance.runPythonAsync.mock.calls[1][0]).toBe(
      'some_user_code',
    );
  });

  it('should throw a specific TypeError if data contains a list key', async () => {
    // Arrange: Configure the mock to simulate the Python validation script finding a list key.
    mockPyodideInstance.runPythonAsync.mockImplementation(
      async (code: string) => {
        if (code.includes('_validate_data_keys')) {
          const error = new Error(
            "Unsupported key type 'list' found in input data.",
          );
          (error as any).type = 'TypeError';
          throw error;
        }
        return 'User script executed';
      },
    );

    // Act & Assert
    await expect(
      runner.run('test-session', 'some_user_code', {
        globals: { bad_key: [] },
      }),
    ).rejects.toThrow(
      "Input data validation failed: Unsupported key type 'list' found in input data.",
    );
  });
});
