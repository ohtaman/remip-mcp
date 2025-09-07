import { randomUUID } from 'crypto';
import { StorageService } from '../app/storage.js';
import { PyodideRunner } from '../app/pyodideRunner.js';
import { ReMIPClient } from '../connectors/remip/ReMIPClient.js';
import { SolutionObject, SolutionSummary } from '../schemas/solutions.js';
import { Problem } from '../connectors/remip/types.js';

interface SolveProblemParams {
  model_name: string;
  data: Record<string, unknown>;
}

interface SolveProblemServices {
  storageService: StorageService;
  pyodideRunner: PyodideRunner;
  remipClient: ReMIPClient;
  sendNotification: (notification: {
    method: string;
    params: unknown;
  }) => Promise<void>;
}

export async function solveProblem(
  sessionId: string,
  params: SolveProblemParams,
  services: SolveProblemServices,
): Promise<SolutionSummary> {
  const { storageService, pyodideRunner, remipClient } = services;

  const model = storageService.getModel(sessionId, params.model_name);
  if (!model) {
    throw new Error(`Model not found: ${params.model_name}`);
  }

  // --- Validation Step ---
  const requiredInputs = new Set(model.inputs);
  const providedInputs = new Set(Object.keys(params.data));
  if (
    requiredInputs.size !== providedInputs.size ||
    ![...requiredInputs].every((key) => providedInputs.has(key as string))
  ) {
    throw new Error(
      `Input data does not match model inputs. Required: ${model.inputs.join(
        ',',
      )}. Provided: ${Object.keys(params.data).join(',')}`,
    );
  }

  // --- Problem Generation ---
  // We combine the user's code with a script to find and serialize the LpProblem
  const executionCode = `
import json
import pulp

# --- User's model code will be executed here ---
${model.code}
# --- End of user's model code ---

# Find all LpProblem instances in the global scope
lp_problems = [v for v in globals().values() if isinstance(v, pulp.LpProblem)]

if len(lp_problems) == 1:
    json.dumps(lp_problems[0].toDict())
elif len(lp_problems) == 0:
    raise ValueError("No pulp.LpProblem instance found in the model code.")
else:
    raise ValueError("Multiple pulp.LpProblem instances found. Please ensure only one is defined.")
`;

  const problemString = (await pyodideRunner.run(sessionId, executionCode, {
    globals: { data: params.data },
  })) as string;

  const problem: Problem = JSON.parse(problemString);

  // --- Solving ---
  const startTime = Date.now();
  const solutionResult = await remipClient.solve(problem);
  const solveTime = (Date.now() - startTime) / 1000;

  if (!solutionResult) {
    throw new Error('Solver failed to produce a solution.');
  }

  const solutionId = `sol-${randomUUID()}`;
  const solution: SolutionObject = {
    solution_id: solutionId,
    status: 'Optimal', // This needs to be properly mapped from solver result
    objective_value: solutionResult.objectiveValue,
    solve_time_seconds: solveTime,
    variables: solutionResult.variableValues,
  };

  storageService.setSolution(sessionId, solution);

  const { variables, ...summary } = solution;
  return summary;
}
