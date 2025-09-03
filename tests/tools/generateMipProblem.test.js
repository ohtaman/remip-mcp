import { generateMipProblem } from '@tools/generateMipProblem';
import { PyodideRunner } from '@app/pyodideRunner';
import { StorageService } from '@app/storage';
jest.mock('@app/pyodideRunner');
jest.mock('@app/storage');
describe('generateMipProblem', () => {
    let pyodideRunner;
    let storageService;
    beforeEach(() => {
        pyodideRunner = new PyodideRunner();
        storageService = new StorageService();
    });
    it('should generate a problem, store it, and return a problemId', async () => {
        const sessionId = 'session1';
        const problemDefinitionCode = 'import pulp\nproblem = pulp.LpProblem("test")';
        const mockPyodide = {
            runPython: jest.fn(),
            loadPackage: jest.fn(),
            pyimport: jest.fn().mockReturnValue({ install: jest.fn() }),
            globals: {
                get: jest.fn().mockReturnValue({ toJs: () => ({ some: 'data' }) })
            }
        };
        pyodideRunner.getPyodide.mockResolvedValue(mockPyodide);
        const problemId = await generateMipProblem(sessionId, { problemDefinitionCode }, { pyodideRunner, storageService });
        expect(pyodideRunner.getPyodide).toHaveBeenCalledWith(sessionId);
        expect(mockPyodide.runPython).toHaveBeenCalledWith(problemDefinitionCode);
        expect(storageService.set).toHaveBeenCalledWith(sessionId, expect.any(String), { some: 'data' });
        expect(problemId).toEqual({ problemId: expect.any(String) });
    });
});
