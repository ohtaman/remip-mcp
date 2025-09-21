import { PyodideRunner } from '../app/pyodideRunner.js';
import { StorageService } from '../app/storage.js';
import { Model } from '../schemas/models.js';

interface DefineModelParams {
  model_name: string;
  model_code: string;
}

interface DefineModelServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
}

const DISCOVERY_SCRIPT = `
import pulp

problem_instances = [v for v in globals().values() if isinstance(v, pulp.LpProblem)]
print(len(problem_instances))
`;

async function _validateModelCode(
  sessionId: string,
  pyodideRunner: PyodideRunner,
  model_code: string,
  sample_data?: Record<string, unknown>,
) {
  const validationScript = `
${model_code}

${DISCOVERY_SCRIPT}
`;

  try {
    await pyodideRunner.run(sessionId, validationScript, {
      globals: sample_data,
    });
    const { stdout, stderr } = pyodideRunner.getOutput(sessionId);
    const problemCount = parseInt(stdout.trim(), 10);

    if (isNaN(problemCount)) {
      // This can happen if there was a runtime error in the user's code
      throw new Error(`Error executing model code: ${stderr}`);
    }

    if (problemCount === 0) {
      throw new Error('No pulp.LpProblem instance found in the model code.');
    }
    if (problemCount > 1) {
      throw new Error(
        'Multiple pulp.LpProblem instances found. Please ensure only one is defined.',
      );
    }
  } catch (e: unknown) {
    if (e instanceof Error) {
      throw new Error(`Error executing model: ${e.message}`);
    }
    throw new Error(`An unknown error occurred during model execution.`);
  }
}

export async function defineModel(
  sessionId: string,
  params: DefineModelParams,
  services: DefineModelServices,
) {
  if (!params.model_name || params.model_name.trim().length === 0) {
    throw new Error('Model name cannot be empty.');
  }

  const { storageService, pyodideRunner } = services;

  await _validateModelCode(sessionId, pyodideRunner, params.model_code);

  const model: Model = {
    name: params.model_name,
    code: params.model_code,
    type: 'pulp.LpProblem',
  };

  storageService.setModel(sessionId, model);

  return {
    status: 'ok',
    model_name: model.name,
    model_type: model.type,
  };
}
