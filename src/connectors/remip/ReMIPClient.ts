import { EventEmitter } from 'node:events';
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
export class ReMIPClient extends EventEmitter {
  private readonly baseUrl: string;
  private readonly stream: boolean;
  private readonly logger: Logger;

  constructor({
    baseUrl = 'http://localhost:8000',
    stream = true,
    logger,
  }: ReMIPClientOptions) {
    super();
    this.baseUrl = baseUrl;
    this.stream = stream;
    this.logger = logger;
  }

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

    const rawSolution = await response.json();
    if (rawSolution && rawSolution.objective_value !== undefined) {
      return {
        objectiveValue: rawSolution.objective_value,
        variableValues: rawSolution.variable_values,
      };
    }
    return null;
  }

  private async solveWithStreaming(problem: Problem): Promise<Solution | null> {
    const response = await fetch(`${this.baseUrl}/solve?stream=sse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(problem),
    });
    return this.parseStreamingResponse(response);
  }

  private async parseStreamingResponse(
    response: Response,
  ): Promise<Solution | null> {
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

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) {
          currentEvent = null;
          continue;
        }

        if (line.startsWith('event: ')) {
          currentEvent = line.substring(7).trim();
        } else if (line.startsWith('data: ')) {
          if (!currentEvent) continue;

          const dataStr = line.substring(6).trim();
          try {
            const data = JSON.parse(dataStr);

            switch (currentEvent) {
              case 'result': {
                const rawSolution = 'solution' in data ? data.solution : data;
                if (rawSolution && rawSolution.objective_value !== undefined) {
                  solution = {
                    objectiveValue: rawSolution.objective_value,
                    variableValues: rawSolution.variables,
                  };
                }
                break;
              }
              case 'log': {
                const logData = data as LogData;
                this.emit('log', logData);
                break;
              }
              case 'metric': {
                const metricData = data as MetricData;
                this.emit('metric', metricData);
                break;
              }
              default:
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
