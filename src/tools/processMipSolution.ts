
import { PyodideRunner } from '../app/pyodideRunner.js';
import { StorageService } from '../app/storage.js';

export async function processMipSolution(
  sessionId: string,
  args: { solutionId: string, validationCode: string },
  services: { pyodideRunner: PyodideRunner, storageService: StorageService }
): Promise<{ status: string, message: string }> {
  const { pyodideRunner, storageService } = services;
  const solution = storageService.get(sessionId, args.solutionId);
  if (!solution) {
    throw new Error('Solution not found');
  }

  const pyodide = await pyodideRunner.getPyodide(sessionId);
  pyodide.globals.set('solution', solution);
  await pyodide.runPython(args.validationCode);

  return { status: 'success', message: 'Validation successful' };
}
