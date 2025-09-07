import { getSolution } from '../../src/tools/getSolution';
import { StorageService } from '../../src/app/storage';
import { SolutionObject } from '../../src/schemas/solutions';

describe('getSolution Tool', () => {
  let storageService: StorageService;
  const sessionId = 'test-session';

  const solution: SolutionObject = {
    solution_id: 'sol1',
    status: 'Optimal',
    objective_value: 100,
    solve_time_seconds: 1,
    variables: { x: 1, y: 0, z: 5 },
  };

  beforeEach(() => {
    storageService = new StorageService();
    storageService.setSolution(sessionId, solution);
  });

  it('should retrieve a full solution by ID when requested', async () => {
    const result = await getSolution(
      sessionId,
      { solution_id: 'sol1', include_zero_variables: true },
      { storageService },
    );
    expect(result).toEqual(solution);
  });

  it('should throw an error for a non-existent solution', async () => {
    await expect(
      getSolution(
        sessionId,
        { solution_id: 'non-existent' },
        { storageService },
      ),
    ).rejects.toThrow('Solution not found: non-existent');
  });

  it('should filter zero-value variables by default', async () => {
    const result = await getSolution(
      sessionId,
      { solution_id: 'sol1' },
      { storageService },
    );
    expect(result.variables).toEqual({ x: 1, z: 5 });
  });

  it('should include zero-value variables when requested', async () => {
    const result = await getSolution(
      sessionId,
      { solution_id: 'sol1', include_zero_variables: true },
      { storageService },
    );
    expect(result.variables).toEqual({ x: 1, y: 0, z: 5 });
  });

  it('should handle solutions with null objective and no variables', async () => {
    const infeasibleSolution: SolutionObject = {
      solution_id: 'sol2',
      status: 'Infeasible',
      objective_value: null,
      solve_time_seconds: 1,
      variables: null as any, // Simulate no variables
    };
    storageService.setSolution(sessionId, infeasibleSolution);

    const result = await getSolution(
      sessionId,
      { solution_id: 'sol2' },
      { storageService },
    );
    expect(result.objective_value).toBeNull();
    expect(result.variables).toEqual({});
  });
});
