import { z } from 'zod';

// Base object for Model to be used in schemas
const modelSchemaObject = {
  name: z.string(),
  code: z.string(),
  type: z.literal('pulp.LpProblem'),
  inputs: z.array(z.string()),
};

// Base object for SolutionSummary
const solutionSummarySchemaObject = {
  solution_id: z.string(),
  status: z.union([
    z.literal('optimal'),
    z.literal('infeasible'),
    z.literal('unbounded'),
    z.literal('not solved'),
    z.literal('timelimit'),
  ]),
  objective_value: z.number().nullable(),
  solve_time_seconds: z.number(),
};

// Base object for SolutionObject
const solutionObjectSchemaObject = {
  ...solutionSummarySchemaObject,
  variables: z.record(z.number()),
};

export const defineModelSchema = z.object({
  model_name: z.string(),
  model_code: z.string(),
  inputs: z.array(z.string()),
});

export const solveProblemSchema = z.object({
  model_name: z.string(),
  data: z.record(z.unknown()),
});

export const getSolutionSchema = z.object({
  solution_id: z.string(),
  include_zero_variables: z.boolean().optional().default(false),
});

export const processSolutionSchema = z.object({
  solution_id: z.string(),
  processing_code: z.string(),
});

export const getModelSchema = z.object({
  model_name: z.string(),
});

export const defineModelOutputSchema = z.object({
  status: z.literal('ok'),
  model_name: z.string(),
  model_type: z.literal('pulp.LpProblem'),
});

export const solveProblemOutputSchema = z.object({
  summary: z.object(solutionSummarySchemaObject),
});

export const getSolutionOutputSchema = z.object({
  solution: z.object(solutionObjectSchemaObject),
});

export const processSolutionOutputSchema = z.object({
  result: z.string(),
  stdout: z.string(),
  stderr: z.string(),
});

export const listModelsOutputSchema = z.object({
  models: z.array(z.object(modelSchemaObject)),
});

export const getModelOutputSchema = z.object({
  model: z.object(modelSchemaObject),
});

export const listSolutionsOutputSchema = z.object({
  solutions: z.array(z.object(solutionSummarySchemaObject)),
});

export const checkPackagesOutputSchema = z.object({
  status: z.literal('ok'),
  installed: z.array(z.string()),
  not_installed: z.array(z.string()),
});

export const getModelJsonOutputSchema = z.object({
  model_json: z.record(z.unknown()),
});
