import { StorageService } from '../app/storage.js';
import { PyodideRunner } from '../app/pyodideRunner.js';

interface ProcessSolutionParams {
  solution_id: string;
  processing_code: string;
}

interface ProcessSolutionServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
}

export async function processSolution(
  sessionId: string,
  params: ProcessSolutionParams,
  services: ProcessSolutionServices,
): Promise<unknown> {
  const { storageService, pyodideRunner } = services;
  const solution = storageService.getSolution(sessionId, params.solution_id);

  if (!solution) {
    throw new Error(`Solution not found: ${params.solution_id}`);
  }

  return await pyodideRunner.run(sessionId, params.processing_code, {
    globals: { solution: solution },
  });
}
