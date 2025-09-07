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
    status: 'Optimal',
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
    it('should return a list of all solution summaries', async () => {
      const result = await listSolutions(sessionId, {}, { storageService });
      const { variables: _variables, ...summary } = solution1;
      expect(result).toEqual([summary]);
    });
  });
});
