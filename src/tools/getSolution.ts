import { StorageService } from '../app/storage.js';
import { SolutionObject } from '../schemas/solutions.js';

interface GetSolutionParams {
  solution_id: string;
  include_zero_variables?: boolean;
}

interface GetSolutionServices {
  storageService: StorageService;
}

export async function getSolution(
  sessionId: string,
  params: GetSolutionParams,
  services: GetSolutionServices,
): Promise<SolutionObject> {
  const { storageService } = services;
  const solution = storageService.getSolution(sessionId, params.solution_id);

  if (!solution) {
    throw new Error(`Solution not found: ${params.solution_id}`);
  }

  if (!solution.variables || params.include_zero_variables) {
    return {
      ...solution,
      variables: solution.variables || {},
    };
  }

  const filteredVariables: Record<string, number> = {};
  for (const [key, value] of Object.entries(solution.variables)) {
    if (value !== 0) {
      filteredVariables[key] = value as number;
    }
  }

  return {
    ...solution,
    variables: filteredVariables,
  };
}
