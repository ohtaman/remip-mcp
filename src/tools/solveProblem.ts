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
  timeout?: number;
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
  const { storageService, pyodideRunner, remipClient, sendNotification } =
    services;

  try {
    await sendNotification({
      method: 'progress',
      params: { progress: 0, message: 'Starting problem solving...' },
    });

    const model = storageService.getModel(sessionId, params.model_name);
    if (!model) {
      throw new Error(`Model not found: ${params.model_name}`);
    }

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

    const executionCode = `
# --- User's Model Code ---
${model.code}

# --- Discovery Code ---
import json
import pulp
import numpy as np

# Custom JSON encoder to handle numpy types
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return super(NumpyEncoder, self).default(obj)

lp_problems = [v for v in globals().values() if isinstance(v, pulp.LpProblem)]

result = {"error": None, "problem": None}
if len(lp_problems) == 1:
    result["problem"] = lp_problems[0].toDict()
elif len(lp_problems) == 0:
    result["error"] = "No pulp.LpProblem instance found in the model code."
else:
    result["error"] = "Multiple pulp.LpProblem instances found. Please ensure only one is defined."

json.dumps(result, cls=NumpyEncoder)
`;

    const result = await pyodideRunner.run(sessionId, executionCode, {
      globals: { ...params.data },
    });

    await sendNotification({
      method: 'progress',
      params: {
        progress: 0.3,
        message: 'Generating problem from model code...',
      },
    });

    if (typeof result !== 'string') {
      throw new Error(
        'Could not serialize the PuLP problem from the model code.',
      );
    }

    const discoveryResult = JSON.parse(result) as DiscoveryResult;

    if (discoveryResult.error || !discoveryResult.problem) {
      throw new Error(
        discoveryResult.error || 'Unknown error during problem discovery.',
      );
    }

    const problem: Problem = discoveryResult.problem;

    const logListener = (log: { message: string }) => {
      sendNotification({
        method: 'log',
        params: { message: `[Solver] ${log.message}` },
      });
    };
    remipClient.on('log', logListener);

    const startTime = Date.now();
    const solutionResult = await remipClient.solve(problem, params.timeout);
    const solveTime = (Date.now() - startTime) / 1000;

    remipClient.off('log', logListener);

    await sendNotification({
      method: 'progress',
      params: { progress: 1.0, message: 'Problem solved successfully.' },
    });

    if (!solutionResult) {
      throw new Error('Solver failed to produce a solution.');
    }

    const solutionId = `sol-${randomUUID()}`;
    const solution: SolutionObject = {
      solution_id: solutionId,
      status: solutionResult.status as SolutionSummary['status'],
      objective_value: solutionResult.objective_value,
      solve_time_seconds: solveTime,
      variables: solutionResult.variables,
      mip_gap: solutionResult.mip_gap,
      slacks: solutionResult.slacks,
      duals: solutionResult.duals,
      reduced_costs: solutionResult.reduced_costs,
    };

    logger.info({ solution }, 'Saving solution object to storage');
    storageService.setSolution(sessionId, solution);

    const summary: SolutionSummary = {
      solution_id: solution.solution_id,
      status: solution.status,
      objective_value: solution.objective_value,
      solve_time_seconds: solution.solve_time_seconds,
    };
    return summary;
  } catch (error: unknown) {
    let errorMessage = 'An unknown error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (
      typeof error === 'object' &&
      error !== null &&
      'message' in error
    ) {
      errorMessage = String((error as { message: unknown }).message);
    } else {
      errorMessage = String(error);
    }

    // Send error notification before throwing
    await sendNotification({
      method: 'error',
      params: { message: errorMessage },
    });

    throw new Error(
      `An error occurred in the model code execution: ${errorMessage}`,
    );
  }
}
