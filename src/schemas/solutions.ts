import { z } from 'zod';

// The summary returned by solve_problem and list_solutions
export interface SolutionSummary {
  solution_id: string;
  status: 'not solved' | 'optimal' | 'infeasible' | 'unbounded' | 'timeout';
  objective_value: number | null;
  solve_time_seconds: number;
}

// The full object stored on the server and returned by get_solution
export interface SolutionObject extends SolutionSummary {
  variables: Record<string, number>;
  mip_gap?: number | null;
  slacks?: Record<string, number> | null;
  duals?: Record<string, number> | null;
  reduced_costs?: Record<string, number> | null;
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

export const mipSolutionSchema = z.object({
  name: z.string(),
  status: z.enum([
    'not solved',
    'optimal',
    'infeasible',
    'unbounded',
    'timeout',
  ]),
  objective_value: z.number().nullable(),
  variables: z.record(z.string(), z.number()),
  mip_gap: z.number().nullable().optional(),
  slacks: z.record(z.string(), z.number()).nullable().optional(),
  duals: z.record(z.string(), z.number()).nullable().optional(),
  reduced_costs: z.record(z.string(), z.number()).nullable().optional(),
});

export const remipResultSchema = z.object({
  type: z.literal('result'),
  data: mipSolutionSchema,
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
export type MipSolution = z.infer<typeof mipSolutionSchema>;
