import { StorageService } from '../app/storage.js';
import { PyodideRunner } from '../app/pyodideRunner.js';

interface ValidateSolutionParams {
  solution_id: string;
  validation_code: string;
}

interface ValidateSolutionOutputs {
  result: string;
  stdout: string;
  stderr: string;
}

interface ValidateSolutionServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
}

export async function validateSolution(
  sessionId: string,
  params: ValidateSolutionParams,
  services: ValidateSolutionServices,
): Promise<ValidateSolutionOutputs> {
  const { storageService, pyodideRunner } = services;
  const solution = storageService.getSolution(sessionId, params.solution_id);

  if (!solution) {
    throw new Error(`Solution not found: ${params.solution_id}`);
  }

  // Your elegant solution:
  const solutionJson = JSON.stringify(solution);
  const fullCode = `
import json
solution = json.loads('''${solutionJson}''')

# --- User's Code ---
${params.validation_code}
`;

  const result = await pyodideRunner.run(sessionId, fullCode);
  const { stdout, stderr } = pyodideRunner.getOutput(sessionId);

  return {
    result: String(result),
    stdout: stdout,
    stderr: stderr,
  };
}
