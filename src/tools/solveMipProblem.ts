import { randomUUID } from 'crypto';
import { StorageService } from '../app/storage.js';
import { ReMIPClient } from '../connectors/remip/ReMIPClient.js';
import { Problem } from '../connectors/remip/types.js';
import { Solution } from '../schemas/solutions.js';

export async function solveMipProblem(
  sessionId: string,
  args: { problemId: string },
  services: { storageService: StorageService; remipClient: ReMIPClient },
): Promise<{ solutionId: string; solution: Solution | null }> {
  const { storageService, remipClient } = services;
  const problem = storageService.get<Problem>(sessionId, args.problemId);
  if (!problem) {
    throw new Error('Problem not found');
  }

  const solution = await remipClient.solve(problem);

  const solutionId = randomUUID();
  storageService.set(sessionId, solutionId, solution);

  return { solutionId, solution };
}
