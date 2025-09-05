import { Solution } from '../../schemas/solutions.js';
import type {
  Problem,
  LogData,
  MetricData,
  ReMIPClientOptions,
  Logger,
} from './types.js';

/**
 * A client for connecting to and interacting with the ReMIP (Remote MIP) Server API.
 * It can handle both standard JSON and streaming (Server-Sent Events) responses.
 */
export class ReMIPClient {
  private readonly baseUrl: string;
  private readonly stream: boolean;
  private readonly logger: Logger;

  /**
   * Constructs an instance of the ReMIPClient.
   * @param options - Configuration options for the client.
   */
  constructor({
    baseUrl = 'http://localhost:8000',
    stream = true,
    logger,
  }: ReMIPClientOptions) {
    this.baseUrl = baseUrl;
    this.stream = stream;
    this.logger = logger;
  }

  /**
   * Solves a given optimization problem by sending it to the ReMIP server.
   * @param problem - A structured object representing the optimization problem.
   * @returns A promise that resolves to the solution, or null if solving failed.
   */
  public async solve(problem: Problem): Promise<Solution | null> {
    try {
      if (this.stream) {
        return await this.solveWithStreaming(problem);
      } else {
        return await this.solveNonStreaming(problem);
      }
    } catch (error) {
      this.logger.error(
        { err: error },
        '[ReMIPClient] Fatal error during API call',
      );
      return null;
    }
  }

  /**
   * Solves the problem using a standard, non-streaming HTTP request.
   * @private
   */
  private async solveNonStreaming(problem: Problem): Promise<Solution | null> {
    const response = await fetch(`${this.baseUrl}/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(
        `API request failed with status ${response.status}: ${errorBody}`,
      );
    }

    return (await response.json()) as Solution;
  }

  /**
   * Solves the problem using a streaming connection (Server-Sent Events).
   * This allows for real-time logging and progress updates from the server.
   * @private
   */
  private async solveWithStreaming(problem: Problem): Promise<Solution | null> {
    const response = await fetch(`${this.baseUrl}/solve?stream=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
    });

    if (!response.ok || !response.body) {
      const errorBody = await response.text();
      throw new Error(
        `API request failed with status ${response.status}: ${errorBody}`,
      );
    }

    let solution: Solution | null = null;
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let currentEvent: string | null = null;

    // Process the stream chunk by chunk
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the last, potentially incomplete, line

      for (const line of lines) {
        if (!line.trim()) {
          // An empty line signals the end of an event block
          currentEvent = null;
          continue;
        }

        if (line.startsWith('event: ')) {
          currentEvent = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          if (!currentEvent) continue; // Ignore data without an event type

          const dataStr = line.substring(6).trim();
          try {
            const data = JSON.parse(dataStr);

            switch (currentEvent) {
              case 'result':
                // The result can be the data object itself or nested in a 'solution' field
                solution = 'solution' in data ? data.solution : data;
                break;
              case 'log': {
                const logData = data as LogData;
                this.logger.info(
                  `[ReMIP Log][${logData.timestamp}] ${logData.message}`,
                );
                break;
              }
              case 'metric': {
                const metricData = data as MetricData;
                this.logger.info(
                  `[ReMIP Metric][${metricData.timestamp}] Iter: ${metricData.iteration}, Obj: ${metricData.objective_value}, Gap: ${metricData.gap}`,
                );
                break;
              }
              default:
                // Silently ignore unknown event types
                break;
            }
          } catch (e) {
            console.warn(
              `[ReMIPClient] Failed to parse JSON data from SSE stream: "${dataStr}"`,
              e,
            );
          }
        }
      }
    }

    if (!solution) {
      console.warn(
        '[ReMIPClient] Stream ended but did not receive a final solution from the server.',
      );
    }

    return solution;
  }
}
