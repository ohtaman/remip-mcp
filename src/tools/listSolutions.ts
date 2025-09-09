import { StorageService } from '../app/storage.js';
import { SolutionSummary } from '../schemas/solutions.js';

export async function listSolutions(
  sessionId: string,
  params: Record<string, never>,
  services: { storageService: StorageService },
): Promise<SolutionSummary[]> {
  return services.storageService.listSolutions(sessionId);
}
