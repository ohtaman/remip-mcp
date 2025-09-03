
import { randomUUID } from 'crypto';
import { PyodideRunner } from '../app/pyodideRunner.js';
import { StorageService } from '../app/storage.js';

export async function generateMipProblem(
  sessionId: string,
  args: { problemDefinitionCode: string },
  services: { pyodideRunner: PyodideRunner, storageService: StorageService }
): Promise<{ problemId: string, stdout: string, stderr: string }> {
  const { pyodideRunner, storageService } = services;
  const pyodide = await pyodideRunner.getPyodide(sessionId);

  // Initial output before execution
  let allStdout = '';
  let allStderr = '';

  await pyodide.loadPackage('micropip');
  const micropip = pyodide.pyimport('micropip');
  await micropip.install('pulp');
  let output = pyodideRunner.getOutput(sessionId);
  allStdout += output.stdout;
  allStderr += output.stderr;

  pyodide.runPython(args.problemDefinitionCode);
  output = pyodideRunner.getOutput(sessionId);
  allStdout += output.stdout;
  allStderr += output.stderr;

  const problemFinderScript = `
import pulp
__problem_names__ = [
    name for name, var in globals().items()
    if isinstance(var, pulp.LpProblem)
]
  `;
  pyodide.runPython(problemFinderScript);
  output = pyodideRunner.getOutput(sessionId);
  allStdout += output.stdout;
  allStderr += output.stderr;

  const problemNamesProxy = pyodide.globals.get('__problem_names__');
  if (problemNamesProxy === undefined) {
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
  output = pyodideRunner.getOutput(sessionId);
  allStdout += output.stdout;
  allStderr += output.stderr;

  const problem = JSON.parse(problemDictString);

  // Ensure all constraints have a name
  if (problem.constraints) {
    problem.constraints.forEach((constraint: { name?: string }, index: number) => {
      if (!constraint.name) {
        constraint.name = `constraint_${index}`;
      }
    });
  }

  // Ensure the objective has a name
  if (problem.objective && !problem.objective.name) {
    problem.objective.name = 'objective';
  }

  const problemId = randomUUID();
  storageService.set(sessionId, problemId, problem);

  return { problemId, stdout: allStdout, stderr: allStderr };
}
