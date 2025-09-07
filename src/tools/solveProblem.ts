import { randomUUID } from 'crypto';
import { StorageService } from '../app/storage.js';
import { PyodideRunner } from '../app/pyodideRunner.js';
import { ReMIPClient } from '../connectors/remip/ReMIPClient.js';
import { SolutionObject, SolutionSummary } from '../schemas/solutions.js';
import { Problem } from '../connectors/remip/types.js';
import { logger } from '../app/logger.js';

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

interface DiscoveryResult {
  problem: Problem | null;
  error: string | null;
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
  try {
    logger.info(
      { event: 'solve_problem.run_user_code.start' },
      "Running user's model code",
    );
    await pyodideRunner.run(sessionId, model.code, {
      globals: { data: params.data },
    });
    logger.info(
      { event: 'solve_problem.run_user_code.end' },
      "Finished running user's model code",
    );

    const discoveryCode = `
import json
import pulp

lp_problems = [v for v in globals().values() if isinstance(v, pulp.LpProblem)]

result = {"error": None, "problem": None}
if len(lp_problems) == 1:
    result["problem"] = lp_problems[0].toDict()
elif len(lp_problems) == 0:
    result["error"] = "No pulp.LpProblem instance found in the model code."
else:
    result["error"] = "Multiple pulp.LpProblem instances found. Please ensure only one is defined."

json.dumps(result)
`;
    logger.info(
      { event: 'solve_problem.run_discovery.start' },
      'Running discovery code',
    );
    const resultProxy = (await pyodideRunner.run(sessionId, discoveryCode)) as
      | { toJs: () => string }
      | undefined;
    logger.info(
      { event: 'solve_problem.run_discovery.end', result: resultProxy },
      'Finished running discovery code',
    );

    if (!resultProxy || typeof resultProxy.toJs !== 'function') {
      throw new Error(
        'Could not serialize the PuLP problem from the model code.',
      );
    }

    const discoveryResult = JSON.parse(resultProxy.toJs()) as DiscoveryResult;

    if (discoveryResult.error || !discoveryResult.problem) {
      throw new Error(
        discoveryResult.error || 'Unknown error during problem discovery.',
      );
    }

    const problem: Problem = discoveryResult.problem;

    // --- Solving ---
    logger.info(
      { event: 'solve_problem.remip_solve.start' },
      'Calling ReMIP solver',
    );
    const startTime = Date.now();
    const solutionResult = await remipClient.solve(problem);
    const solveTime = (Date.now() - startTime) / 1000;
    logger.info(
      { event: 'solve_problem.remip_solve.end', solveTime },
      'ReMIP solver finished',
    );

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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { variables: _variables, ...summary } = solution;
    return summary;
  } catch (error) {
    logger.error(
      { err: error },
      'An error occurred during solve_problem execution.',
    );
    // Re-throw the error to be handled by the MCP server
    throw error;
  }
}
