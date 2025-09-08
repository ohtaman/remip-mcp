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
): Promise<string> {
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

  if (result !== null && result !== undefined) {
    return String(result);
  }

  const { stdout } = pyodideRunner.getOutput(sessionId);
  if (stdout) {
    return stdout;
  }

  return 'Code executed successfully with no output.';
}
