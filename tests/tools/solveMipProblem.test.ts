import { solveMipProblem } from '../../src/tools/solveMipProblem';
import { StorageService } from '../../src/app/storage';
import { ReMIPClient } from '../../src/connectors/remip/ReMIPClient';
import { Solution } from '../../src/schemas/solutions';

// Mock the dependencies
jest.mock('../../src/app/storage');
jest.mock('../../src/connectors/remip/ReMIPClient');

describe('solveMipProblem', () => {
  let storageService: jest.Mocked<StorageService>;
  let remipClient: jest.Mocked<ReMIPClient>;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    storageService = new StorageService() as jest.Mocked<StorageService>;
    // We can provide a minimal mock implementation for ReMIPClient
    remipClient = {
      solve: jest.fn(),
      on: jest.fn(),
    } as unknown as jest.Mocked<ReMIPClient>;
  });

  it('should retrieve a problem, solve it, store the solution, and return both solutionId and solution', async () => {
    const sessionId = 'session-123';
    const problemId = 'problem-abc';
    const mockProblem = { name: 'TestProblem' }; // Mock problem data
    const mockSolution: Solution = {
      // Mock solution data conforming to the schema
      objectiveValue: 100,
      variableValues: { x: 10 },
    };

    // Setup mock return values
    storageService.get.mockReturnValue(mockProblem);
    remipClient.solve.mockResolvedValue(mockSolution);

    const sendNotification = jest.fn();
    const result = await solveMipProblem(
      sessionId,
      { problemId },
      { storageService, remipClient, sendNotification },
    );

    // Verify the interactions
    expect(storageService.get).toHaveBeenCalledWith(sessionId, problemId);
    expect(remipClient.solve).toHaveBeenCalledWith(mockProblem);
    expect(storageService.set).toHaveBeenCalledWith(
      sessionId,
      expect.any(String),
      mockSolution,
    );

    // Verify the result structure and content
    expect(result).toHaveProperty('solutionId');
    expect(typeof result.solutionId).toBe('string');
    expect(result).toHaveProperty('solution');
    expect(result.solution).toEqual(mockSolution);
  });

  it('should throw an error if the problem is not found in storage', async () => {
    const sessionId = 'session-456';
    const problemId = 'problem-def';

    // Setup mock to return undefined
    storageService.get.mockReturnValue(undefined);

    const sendNotification = jest.fn();
    await expect(
      solveMipProblem(
        sessionId,
        { problemId },
        { storageService, remipClient, sendNotification },
      ),
    ).rejects.toThrow('Problem not found');

    // Ensure solve was not called
    expect(remipClient.solve).not.toHaveBeenCalled();
  });
});
