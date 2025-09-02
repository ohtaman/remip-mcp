
import { solveMipProblem } from '@tools/solveMipProblem';
import { StorageService } from '@app/storage';
import { ReMIPClient } from '@connectors/remip/ReMIPClient';
import { Logger } from 'pino';

jest.mock('@app/storage');
jest.mock('@connectors/remip/ReMIPClient');

describe('solveMipProblem', () => {
  let storageService: jest.Mocked<StorageService>;
  let remipClient: jest.Mocked<ReMIPClient>;
  let logger: jest.Mocked<Logger>;

  beforeEach(() => {
    storageService = new StorageService() as jest.Mocked<StorageService>;
    logger = { info: jest.fn() } as any;
    remipClient = new ReMIPClient({
      logger,
      baseUrl: ''
    }) as jest.Mocked<ReMIPClient>;
  });

  it('should retrieve a problem, solve it, store the solution, and return a solutionId', async () => {
    const sessionId = 'session1';
    const problemId = 'problem1';
    const problem = { some: 'data' };
    const solution = { objectiveValue: 123, variableValues: { 'x': 1 } };

    storageService.get.mockReturnValue(problem);
    remipClient.solve.mockResolvedValue(solution);

    const solutionId = await solveMipProblem(sessionId, { problemId }, { storageService, remipClient });

    expect(storageService.get).toHaveBeenCalledWith(sessionId, problemId);
    expect(remipClient.solve).toHaveBeenCalledWith(problem);
    expect(storageService.set).toHaveBeenCalledWith(sessionId, expect.any(String), solution);
    expect(solutionId).toEqual({ solutionId: expect.any(String) });
  });
});
