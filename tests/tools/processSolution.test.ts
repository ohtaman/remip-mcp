import { processSolution } from '../../src/tools/processSolution';
import { StorageService } from '../../src/app/storage';
import { PyodideRunner } from '../../src/app/pyodideRunner';
import { SolutionObject } from '../../src/schemas/solutions';

jest.mock('../../src/app/pyodideRunner');

const MockedPyodideRunner = PyodideRunner as jest.MockedClass<typeof PyodideRunner>;

describe('processSolution Tool', () => {
  let storageService: StorageService;
  let pyodideRunner: jest.Mocked<PyodideRunner>;
  const sessionId = 'test-session';

  const solution: SolutionObject = {
    solution_id: 'sol1',
    status: 'Optimal',
    objective_value: 100,
    solve_time_seconds: 1,
    variables: { x: 1 },
  };

  beforeEach(() => {
    storageService = new StorageService();
    storageService.setSolution(sessionId, solution);
    MockedPyodideRunner.mockClear();
    pyodideRunner = new MockedPyodideRunner('', []) as jest.Mocked<PyodideRunner>;
  });

  it('should throw an error for a non-existent solution', async () => {
    await expect(
      processSolution(
        sessionId,
        { solution_id: 'non-existent', processing_code: '' },
        { storageService, pyodideRunner }
      )
    ).rejects.toThrow('Solution not found: non-existent');
  });

  it('should call pyodideRunner.run with the correct code and solution global', async () => {
    const processing_code = 'solution["variables"]["x"] * 2';
    (pyodideRunner.run as jest.Mock).mockResolvedValue(2);

    const result = await processSolution(
      sessionId,
      { solution_id: 'sol1', processing_code },
      { storageService, pyodideRunner }
    );

    expect(pyodideRunner.run).toHaveBeenCalledWith(sessionId, processing_code, {
      globals: { solution: solution },
    });
    expect(result).toBe(2);
  });
});
