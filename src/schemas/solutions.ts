import { z } from 'zod';

// The summary returned by solve_problem and list_solutions
export interface SolutionSummary {
  solution_id: string;
  status: 'not solved' | 'optimal' | 'infeasible' | 'unbounded' | 'timelimit';
  objective_value: number | null;
  solve_time_seconds: number;
}

// The full object stored on the server and returned by get_solution
export interface SolutionObject extends SolutionSummary {
  variables: Record<string, number>;
}

export const remipMetricSchema = z.object({
  type: z.literal('metric'),
  data: z.object({
    name: z.string(),
    value: z.number(),
    timestamp: z.string(),
  }),
});

export const remipLogSchema = z.object({
  type: z.literal('log'),
  data: z.object({
    message: z.string(),
    timestamp: z.string(),
  }),
});

export const remipStatusSchema = z.object({
  type: z.literal('status'),
  data: z.object({
    status: z.string(),
    timestamp: z.string(),
  }),
});

export const remipResultSchema = z.object({
  type: z.literal('result'),
  data: z.object({
    objective_value: z.number(),
    variable_values: z.record(z.number()),
  }),
});

export const remipEventSchema = z.union([
  remipMetricSchema,
  remipLogSchema,
  remipStatusSchema,
  remipResultSchema,
]);

export type RemipMetric = z.infer<typeof remipMetricSchema>;
export type RemipLog = z.infer<typeof remipLogSchema>;
export type RemipStatus = z.infer<typeof remipStatusSchema>;
export type RemipResult = z.infer<typeof remipResultSchema>;
export type RemipEvent = z.infer<typeof remipEventSchema>;

export const solutionSchema = z.object({
  objectiveValue: z.number(),
  variableValues: z.record(z.string(), z.number()),
});

export type Solution = z.infer<typeof solutionSchema>;
