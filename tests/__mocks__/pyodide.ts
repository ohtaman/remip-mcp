const createMockPyodide = () => ({
  loadPackage: jest.fn().mockResolvedValue(undefined),
  pyimport: jest.fn().mockReturnValue({ install: jest.fn().mockResolvedValue(undefined) }),
  runPython: jest.fn(),
  globals: {
    get: jest.fn(),
    set: jest.fn(),
  },
});

export const loadPyodide = jest.fn().mockImplementation(() => Promise.resolve(createMockPyodide()));