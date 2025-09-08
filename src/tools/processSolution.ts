import { StorageService } from '../app/storage.js';
import { PyodideRunner } from '../app/pyodideRunner.js';

interface ProcessSolutionParams {
  solution_id: string;
  processing_code: string;
}

interface ProcessSolutionOutputs {
  result: string;
  stdout: string;
  stderr: string;
}

interface ProcessSolutionServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
}

export async function processSolution(
  sessionId: string,
  params: ProcessSolutionParams,
  services: ProcessSolutionServices,
): Promise<ProcessSolutionOutputs> {
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
${params.processing_code}
`;

  const result = await pyodideRunner.run(sessionId, fullCode);
  const { stdout, stderr } = pyodideRunner.getOutput(sessionId);

  return {
    result: String(result),
    stdout: stdout,
    stderr: stderr,
  };
}
