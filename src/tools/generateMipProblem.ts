
import { randomUUID } from 'crypto';
import { PyodideRunner } from '../app/pyodideRunner.js';
import { StorageService } from '../app/storage.js';

export async function generateMipProblem(
  sessionId: string,
  args: { problemDefinitionCode: string },
  services: { pyodideRunner: PyodideRunner, storageService: StorageService }
): Promise<{ problemId: string }> {
  const { pyodideRunner, storageService } = services;
  const pyodide = await pyodideRunner.getPyodide(sessionId);
  await pyodide.loadPackage('micropip');
  const micropip = pyodide.pyimport('micropip');
  await micropip.install('pulp');

  pyodide.runPython(args.problemDefinitionCode);
  const problem = pyodide.globals.get('problem').toJs();

  const problemId = randomUUID();
  storageService.set(sessionId, problemId, problem);

  return { problemId };
}
