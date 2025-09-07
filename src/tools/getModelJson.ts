import { PyodideRunner } from '../app/pyodideRunner.js';

export async function getModelJson(
  sessionId: string,
  params: { code: string },
  services: { pyodideRunner: PyodideRunner },
): Promise<string> {
  const { pyodideRunner } = services;
  const code = `
import json
from pulp import *

${params.code}

# Find the LpProblem instance
prob = next(v for v in globals().values() if isinstance(v, LpProblem))
json.dumps(prob.toDict())
`;
  const result = await pyodideRunner.run(sessionId, code);
  return result as string;
}
