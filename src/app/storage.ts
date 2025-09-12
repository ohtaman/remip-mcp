import { Model } from '../schemas/models.js';
import { SolutionObject, SolutionSummary } from '../schemas/solutions.js';

type SessionModels = Map<string, Model>;
type SessionSolutions = Map<string, SolutionObject>;

export class StorageService {
  private modelsBySession: Map<string, SessionModels> = new Map();
  private solutionsBySession: Map<string, SessionSolutions> = new Map();

  private getModelsForSession(sessionId: string): SessionModels {
    if (!this.modelsBySession.has(sessionId)) {
      this.modelsBySession.set(sessionId, new Map());
    }
    return this.modelsBySession.get(sessionId)!;
  }

  private getSolutionsForSession(sessionId: string): SessionSolutions {
    if (!this.solutionsBySession.has(sessionId)) {
      this.solutionsBySession.set(sessionId, new Map());
    }
    return this.solutionsBySession.get(sessionId)!;
  }

  public setModel(sessionId: string, model: Model): void {
    const sessionModels = this.getModelsForSession(sessionId);
    sessionModels.set(model.name, model);
  }

  public getModel(sessionId: string, modelName: string): Model | undefined {
    const sessionModels = this.getModelsForSession(sessionId);
    return sessionModels.get(modelName);
  }

  public listModels(sessionId: string): Model[] {
    const sessionModels = this.getModelsForSession(sessionId);
    return Array.from(sessionModels.values());
  }

  public setSolution(sessionId: string, solution: SolutionObject): void {
    const sessionSolutions = this.getSolutionsForSession(sessionId);
    sessionSolutions.set(solution.solution_id, solution);
  }

  public getSolution(
    sessionId: string,
    solutionId: string,
  ): SolutionObject | undefined {
    const sessionSolutions = this.getSolutionsForSession(sessionId);
    return sessionSolutions.get(solutionId);
  }

  public listSolutions(sessionId: string): SolutionSummary[] {
    const sessionSolutions = this.getSolutionsForSession(sessionId);
    return Array.from(sessionSolutions.values()).map((solution) => {
      return {
        solution_id: solution.solution_id,
        status: solution.status,
        objective_value: solution.objective_value,
        solve_time_seconds: solution.solve_time_seconds,
      };
    });
  }

  public clearSession(sessionId: string): void {
    this.modelsBySession.delete(sessionId);
    this.solutionsBySession.delete(sessionId);
  }
}
