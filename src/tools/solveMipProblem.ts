
import { randomUUID } from 'crypto';
import { StorageService } from '../app/storage.js';
import { ReMIPClient } from '../connectors/remip/ReMIPClient.js';

export async function solveMipProblem(
  sessionId: string,
  args: { problemId: string },
  services: { storageService: StorageService, remipClient: ReMIPClient }
): Promise<{ solutionId: string }> {
  const { storageService, remipClient } = services;
  const problem = storageService.get(sessionId, args.problemId);
  if (!problem) {
    throw new Error('Problem not found');
  }

  const solution = await remipClient.solve(problem as any);

  const solutionId = randomUUID();
  storageService.set(sessionId, solutionId, solution);

  return { solutionId };
}
