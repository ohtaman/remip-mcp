import { StorageService } from '../../src/app/storage';
import { Model } from '../../src/schemas/models';
import { SolutionObject } from '../../src/schemas/solutions';

describe('StorageService', () => {
  let storageService: StorageService;
  const sessionId = 'test-session';

  beforeEach(() => {
    storageService = new StorageService();
  });

  describe('Models', () => {
    const model1: Model = {
      name: 'model1',
      code: 'code1',
      type: 'pulp.LpProblem',
      inputs: ['a'],
    };
    const model2: Model = {
      name: 'model2',
      code: 'code2',
      type: 'pulp.LpProblem',
      inputs: ['b'],
    };

    it('should set and get a model', () => {
      storageService.setModel(sessionId, model1);
      const retrieved = storageService.getModel(sessionId, 'model1');
      expect(retrieved).toEqual(model1);
    });

    it('should return undefined for a non-existent model', () => {
      expect(storageService.getModel(sessionId, 'non-existent')).toBeUndefined();
    });

    it('should list all models for a session', () => {
      storageService.setModel(sessionId, model1);
      storageService.setModel(sessionId, model2);
      const models = storageService.listModels(sessionId);
      expect(models).toEqual([model1, model2]);
    });

    it('should return an empty array if no models exist for a session', () => {
      expect(storageService.listModels(sessionId)).toEqual([]);
    });

    it('should not list models from other sessions', () => {
      storageService.setModel(sessionId, model1);
      storageService.setModel('other-session', model2);
      expect(storageService.listModels(sessionId)).toEqual([model1]);
    });
  });

  describe('Solutions', () => {
    const solution1: SolutionObject = {
      solution_id: 'sol1',
      status: 'Optimal',
      objective_value: 100,
      solve_time_seconds: 1.0,
      variables: { x: 1 },
    };
    const solution2: SolutionObject = {
      solution_id: 'sol2',
      status: 'Infeasible',
      objective_value: null,
      solve_time_seconds: 2.0,
      variables: {},
    };

    it('should set and get a solution', () => {
      storageService.setSolution(sessionId, solution1);
      const retrieved = storageService.getSolution(sessionId, 'sol1');
      expect(retrieved).toEqual(solution1);
    });

    it('should return undefined for a non-existent solution', () => {
      expect(storageService.getSolution(sessionId, 'non-existent')).toBeUndefined();
    });

    it('should list all solution summaries for a session', () => {
      storageService.setSolution(sessionId, solution1);
      storageService.setSolution(sessionId, solution2);
      const summaries = storageService.listSolutions(sessionId);
      // Omit 'variables' for summary
      const { variables: v1, ...summary1 } = solution1;
      const { variables: v2, ...summary2 } = solution2;
      expect(summaries).toEqual([summary1, summary2]);
    });

    it('should not list solutions from other sessions', () => {
        storageService.setSolution(sessionId, solution1);
        storageService.setSolution('other-session', solution2);
        const { variables: v1, ...summary1 } = solution1;
        expect(storageService.listSolutions(sessionId)).toEqual([summary1]);
    });
  });

  describe('Session Management', () => {
    it('should clear all data for a specific session', () => {
        const model: Model = { name: 'm1', code: 'c1', type: 'pulp.LpProblem', inputs: [] };
        const solution: SolutionObject = { solution_id: 's1', status: 'Optimal', objective_value: 1, solve_time_seconds: 1, variables: {} };
        
        storageService.setModel(sessionId, model);
        storageService.setSolution(sessionId, solution);
        storageService.setModel('other-session', model);

        storageService.clearSession(sessionId);

        expect(storageService.getModel(sessionId, 'm1')).toBeUndefined();
        expect(storageService.getSolution(sessionId, 's1')).toBeUndefined();
        expect(storageService.getModel('other-session', 'm1')).toBeDefined();
    });
  });
});
