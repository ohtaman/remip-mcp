const mockGlobals = {
  get: jest.fn().mockReturnValue(
    jest.fn().mockReturnValue({
      set: jest.fn(),
    }),
  ),
  set: jest.fn(),
};

const createMockPyodide = () => ({
  loadPackage: jest.fn().mockResolvedValue(undefined),
  pyimport: jest.fn().mockReturnValue({
    install: jest.fn().mockResolvedValue(undefined),
  }),
  runPythonAsync: jest.fn(async (code) => {
    if (code.includes('str(type(solution))')) {
      return "<class 'dict'>";
    }
    return undefined;
  }),
  setStdout: jest.fn(),
  setStderr: jest.fn(),
  toPy: jest.fn((obj) => obj), // Pass through for testing
  globals: mockGlobals,
});

export const loadPyodide = jest
  .fn()
  .mockImplementation(() => Promise.resolve(createMockPyodide()));
