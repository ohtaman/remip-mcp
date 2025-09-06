import { randomUUID } from 'crypto';
import { StorageService } from '../app/storage.js';
import { ReMIPClient } from '../connectors/remip/ReMIPClient.js';
import { Problem, LogData, MetricData } from '../connectors/remip/types.js';
import { Solution } from '../schemas/solutions.js';

export async function solveMipProblem(
  sessionId: string,
  args: { problemId: string },
  services: {
    storageService: StorageService;
    remipClient: ReMIPClient;
    sendNotification: (notification: {
      method: string;
      params: unknown;
    }) => Promise<void>;
  },
): Promise<{ solutionId: string; solution: Solution | null }> {
  const { storageService, remipClient, sendNotification } = services;
  const problem = storageService.get<Problem>(sessionId, args.problemId);
  if (!problem) {
    throw new Error('Problem not found');
  }

  remipClient.on('log', (log: LogData) => {
    sendNotification({
      method: 'notifications/logging/message',
      params: {
        message: `[ReMIP Log][${log.timestamp}] ${log.message}`,
      },
    });
  });

  remipClient.on('metric', (metric: MetricData) => {
    sendNotification({
      method: 'notifications/logging/message',
      params: {
        message: `[ReMIP Metric][${metric.timestamp}] Iter: ${metric.iteration}, Obj: ${metric.objective_value}, Gap: ${metric.gap}`,
      },
    });
  });

  const solution = await remipClient.solve(problem);

  // Important: Remove listeners after the operation is complete
  remipClient.removeAllListeners('log');
  remipClient.removeAllListeners('metric');

  const solutionId = randomUUID();
  storageService.set(sessionId, solutionId, solution);

  return { solutionId, solution };
}
