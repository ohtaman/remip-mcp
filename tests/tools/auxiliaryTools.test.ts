import { getModel } from '../../src/tools/getModel';
import { listModels } from '../../src/tools/listModels';
import { listSolutions } from '../../src/tools/listSolutions';
import { StorageService } from '../../src/app/storage';
import { Model } from '../../src/schemas/models';
import { SolutionObject } from '../../src/schemas/solutions';

describe('Auxiliary Tools', () => {
  let storageService: StorageService;
  const sessionId = 'test-session';

  const model1: Model = {
    name: 'm1',
    code: 'c1',
    type: 'pulp.LpProblem',
    inputs: [],
  };
  const solution1: SolutionObject = {
    solution_id: 's1',
    status: 'optimal',
    objective_value: 1,
    solve_time_seconds: 1,
    variables: { x: 1 },
  };

  beforeEach(() => {
    storageService = new StorageService();
    storageService.setModel(sessionId, model1);
    storageService.setSolution(sessionId, solution1);
  });

  describe('getModel', () => {
    it('should return the correct model code', async () => {
      const result = await getModel(
        sessionId,
        { model_name: 'm1' },
        { storageService },
      );
      expect(result).toEqual(model1);
    });
    it('should throw if model not found', async () => {
      await expect(
        getModel(sessionId, { model_name: 'not-found' }, { storageService }),
      ).rejects.toThrow('Model not found: not-found');
    });
  });

  describe('listModels', () => {
    it('should return a list of all models', async () => {
      const result = await listModels(sessionId, {}, { storageService });
      expect(result).toEqual([model1]);
    });
  });

  describe('listSolutions', () => {
    it('should return only summary fields, stripping all extra details', async () => {
      // Arrange: Create a full solution object with all possible fields.
      const fullSolution: SolutionObject = {
        solution_id: 's1',
        status: 'optimal',
        objective_value: 1,
        solve_time_seconds: 1,
        // Add all extra fields that should be stripped
        variables: { x: 1 },
        mip_gap: 0.01,
        slacks: { c1: 0 },
        duals: { c1: 0.5 },
        reduced_costs: { x: 0 },
      };
      // Re-initialize storage service to ensure a clean state for this specific test
      storageService = new StorageService();
      storageService.setSolution(sessionId, fullSolution);

      // Act
      const result = await listSolutions(sessionId, {}, { storageService });

      // Assert
      expect(result).toHaveLength(1);
      const summary = result[0];

      // Check that summary fields are present
      expect(summary.solution_id).toBe('s1');
      expect(summary.status).toBe('optimal');

      // Check that extra fields are NOT present
      expect(summary).not.toHaveProperty('variables');
      expect(summary).not.toHaveProperty('mip_gap');
      expect(summary).not.toHaveProperty('slacks');
      expect(summary).not.toHaveProperty('duals');
      expect(summary).not.toHaveProperty('reduced_costs');
    });
  });
});
