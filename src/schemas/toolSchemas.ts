import { z } from 'zod';

// Base object for Model to be used in schemas
const modelSchemaObject = {
  name: z.string().describe('The name of the model.'),
  code: z
    .string()
    .describe('The Python source code to define the model using PuLP library.'),
  type: z
    .literal('pulp.LpProblem')
    .describe(
      'The type of the model object. Currently only supports pulp.LpProblem.',
    ),
  inputs: z
    .array(z.string())
    .describe('The list of input variable names the model requires.'),
};

// Base object for SolutionSummary
const solutionSummarySchemaObject = {
  solution_id: z.string().describe('A unique identifier for the solution.'),
  status: z
    .union([
      z.literal('optimal'),
      z.literal('infeasible'),
      z.literal('unbounded'),
      z.literal('not solved'),
      z.literal('timelimit'),
    ])
    .describe("The status of the solution (e.g., 'optimal', 'infeasible')."),
  objective_value: z
    .number()
    .nullable()
    .describe(
      'The final objective value of the solution, or null if not applicable.',
    ),
  solve_time_seconds: z
    .number()
    .describe('The time taken by the solver to find the solution, in seconds.'),
};

// Base object for SolutionObject
const solutionObjectSchemaObject = {
  ...solutionSummarySchemaObject,
  variables: z
    .record(z.number())
    .nullable()
    .describe(
      'A dictionary of variable names and their corresponding solved values.',
    ),
};

export const defineModelSchema = z.object({
  model_name: z.string().describe('The name of the model to define or update.'),
  model_code: z
    .string()
    .describe(
      'The Python code defining the PuLP model. Must define only one pulp.LpProblem instance globally. You can use PuLP (model definition only), NumPy and Pandas.',
    ),
  inputs: z
    .array(z.string())
    .describe(
      'A list of input data variable names required by the model code for `solve_problem`. The input data will be injected as a list or dictionary before the code is executed. Each name must be a valid Python variable name.',
    ),
});

export const solveProblemSchema = z.object({
  model_name: z
    .string()
    .describe('The name of the pre-defined model to use for solving.'),
  data: z
    .record(z.unknown())
    .describe(
      'A dictionary of input data. Keys must match the variables in the \'inputs\' defined in the model. The input data is made available as global variables in the model code (e.g., if you pass {"activities": [...]}, then "activities" becomes a global variable)',
    ),
});

export const getSolutionSchema = z.object({
  solution_id: z.string().describe('The ID of the solution to retrieve.'),
  include_zero_variables: z
    .boolean()
    .optional()
    .default(true)
    .describe(
      'Whether to include variables with a value of zero in the output. If set to false, variables with a value of 0 will not be returned, which can reduce data size. (default: true)',
    ),
});

export const processSolutionSchema = z.object({
  solution_id: z.string().describe('The ID of the solution to process.'),
  processing_code: z
    .string()
    .describe(
      "A Python script to process the solution. The solution object is available as a global dictionary named 'solution'. You can use PuLP (model definition only), NumPy and Pandas.",
    ),
});

export const getModelSchema = z.object({
  model_name: z.string().describe('The name of the model to retrieve.'),
});

export const defineModelOutputSchema = z.object({
  status: z
    .union([z.literal('ok'), z.literal('ng')])
    .describe('Indicates that the model was defined successfully.'),
  model_name: z.string().describe('The name of the defined or updated model.'),
  model_type: z
    .literal('pulp.LpProblem')
    .describe("The type of the model, which is always 'pulp.LpProblem'."),
});

export const solveProblemOutputSchema = z.object({
  summary: z
    .object(solutionSummarySchemaObject)
    .describe('A summary of the solution.'),
});

export const getSolutionOutputSchema = z.object({
  solution: z
    .object(solutionObjectSchemaObject)
    .describe('The complete solution object, including variable values.'),
});

export const processSolutionOutputSchema = z.object({
  result: z
    .string()
    .describe('The JSON-serialized return value of the processing script.'),
  stdout: z
    .string()
    .describe("Any output captured from the script's standard output."),
  stderr: z
    .string()
    .describe("Any output captured from the script's standard error."),
});

export const listModelsOutputSchema = z.object({
  models: z
    .array(z.object(modelSchemaObject))
    .describe('A list of all registered models.'),
});

export const getModelOutputSchema = z.object({
  model: z.object(modelSchemaObject).describe('The requested model object.'),
});

export const listSolutionsOutputSchema = z.object({
  solutions: z
    .array(z.object(solutionSummarySchemaObject))
    .describe('A list of summaries for all available solutions.'),
});
