
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

  const problemFinderScript = `
import pulp
__problem_names__ = [
    name for name, var in globals().items()
    if isinstance(var, pulp.LpProblem)
]
  `;
  pyodide.runPython(problemFinderScript);
  const problemNamesProxy = pyodide.globals.get('__problem_names__');
  if (problemNamesProxy === undefined) {
    // This should not happen
    throw new Error("Could not execute the LpProblem finder script.");
  }
  const problemNames = problemNamesProxy.toJs();
  problemNamesProxy.destroy();

  if (problemNames.length === 0) {
    throw new Error("No pulp.LpProblem instance was found in the Python script. Please define one.");
  }

  if (problemNames.length > 1) {
    throw new Error(`Multiple pulp.LpProblem instances found: [${problemNames.join(', ')}]. Please define only one.`);
  }

  const problemName = problemNames[0];
  const problemDictString = pyodide.runPython(`
import json
json.dumps(${problemName}.toDict())
`);
  const problem = JSON.parse(problemDictString);

  const problemId = randomUUID();
  storageService.set(sessionId, problemId, problem);

  return { problemId };
}
