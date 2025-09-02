import { validateMipSolution } from '@tools/validateMipSolution';
import { PyodideRunner } from '@app/pyodideRunner';
import { StorageService } from '@app/storage';
jest.mock('@app/pyodideRunner');
jest.mock('@app/storage');
describe('validateMipSolution', () => {
    let pyodideRunner;
    let storageService;
    beforeEach(() => {
        pyodideRunner = new PyodideRunner();
        storageService = new StorageService();
    });
    it('should retrieve a solution, validate it, and return the result', async () => {
        const sessionId = 'session1';
        const solutionId = 'solution1';
        const validationCode = 'print("hello")';
        const solution = { objectiveValue: 123, variableValues: { 'x': 1 } };
        storageService.get.mockReturnValue(solution);
        const mockPyodide = {
            runPython: jest.fn().mockReturnValue(undefined),
            globals: {
                get: jest.fn(),
                set: jest.fn()
            },
            loadPackage: jest.fn(),
            pyimport: jest.fn()
        };
        pyodideRunner.getPyodide.mockResolvedValue(mockPyodide);
        const result = await validateMipSolution(sessionId, { solutionId, validationCode }, { pyodideRunner, storageService });
        expect(storageService.get).toHaveBeenCalledWith(sessionId, solutionId);
        expect(pyodideRunner.getPyodide).toHaveBeenCalledWith(sessionId);
        expect(mockPyodide.globals.set).toHaveBeenCalledWith('solution', solution);
        expect(mockPyodide.runPython).toHaveBeenCalledWith(validationCode);
        expect(result).toEqual({ status: 'success', message: 'Validation successful' });
    });
});
