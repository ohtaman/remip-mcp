import { PyodideRunner } from '../app/pyodideRunner.js';
import { StorageService } from '../app/storage.js';
import { Model } from '../schemas/models.js';

interface DefineModelParams {
  model_name: string;
  model_code: string;
  sample_data?: Record<string, unknown>;
}

interface DefineModelServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
}

const PRE_PROCESS_SCRIPT = `
import ast

def preprocess_data(data):
    for key, value in data.items():
        if isinstance(value, str):
            try:
                data[key] = ast.literal_eval(value)
            except (ValueError, SyntaxError):
                # Keep the original string if it's not a valid literal
                pass
    return data

# Pre-process the injected sample_data if it exists
if 'sample_data' in globals():
    sample_data = preprocess_data(sample_data)
    # Unpack the pre-processed data into the global scope
    globals().update(sample_data)
`;

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
  try {
    await pyodideRunner.run(sessionId, PRE_PROCESS_SCRIPT, {
      globals: { sample_data: sample_data || {} },
    });
  } catch (e: unknown) {
    if (e instanceof Error) {
      if (e.message.includes('SyntaxError')) {
        throw new Error(`Invalid Python syntax in model code: ${e.message}`);
      }
      throw new Error(`Failed to parse string literal: ${e.message}`);
    }
    throw new Error('An unknown error occurred while parsing string literal.');
  }

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

  await _validateModelCode(
    sessionId,
    pyodideRunner,
    params.model_code,
    params.sample_data,
  );

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
