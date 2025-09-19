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
      z.literal('timeout'),
    ])
    .describe(
      `The status of the solution. Possible values are:
- optimal: An optimal solution has been found.
- not solved: The solver was stopped before it could determine the solution status.
- infeasible: The problem is infeasible (no solution exists).
- unbounded: The problem is unbounded (the objective can be made infinitely large).
- timeout: The solver reached a time limit and returned the best solution found so far. This solution is feasible but not guaranteed to be optimal.`,
    ),
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
  mip_gap: z.number().nullable().optional().describe('The final MIP gap.'),
  slacks: z
    .record(z.string(), z.number())
    .nullable()
    .optional()
    .describe('A dictionary of slack values for each constraint.'),
  duals: z
    .record(z.string(), z.number())
    .nullable()
    .optional()
    .describe('A dictionary of dual values for each constraint.'),
  reduced_costs: z
    .record(z.string(), z.number())
    .nullable()
    .optional()
    .describe('A dictionary of reduced costs for each variable.'),
};

export const defineModelSchema = z.object({
  model_name: z.string().describe('The name of the model to define or update.'),
  model_code: z
    .string()
    .describe(
      'The Python code defining the PuLP model. Must define only one pulp.LpProblem instance globally. You can use PuLP (model definition only), NumPy and Pandas.',
    ),
  sample_data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Optional. A dictionary of sample data to validate the model\'s structure *at definition time*. This data is used to validate the code\'s structure upon definition. This data is made available as global variables during this function\'s execution to catch immediate errors. It should mirror the structure of the data that `solve_problem` will eventually use. For complex data structures like a Pandas DataFrame, provide it as a string that can be executed (e.g., `{"my_df": "pd.DataFrame(...)"}`).',
    ),
});

export const solveProblemSchema = z.object({
  model_name: z
    .string()
    .describe(
      'The name of the pre-defined model template (from `define_model`) to use.',
    ),
  data: z
    .record(z.string(), z.unknown())
    .describe(
      'A dictionary of input data to be injected as global variables into the model\'s execution environment. The keys must match the variable names expected by the model code. For complex data like a Pandas DataFrame, provide it as a string that can be executed (e.g., `{"workers_df": "pd.DataFrame(...)"}`)',
    ),
  timeout: z
    .number()
    .optional()
    .describe('Timeout in seconds. This parameter send to the backend solver.'),
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

export const validateSolutionSchema = z.object({
  solution_id: z.string().describe('The ID of the solution to process.'),
  validation_code: z
    .string()
    .describe(
      "A Python script to process the solution. The solution object is available as a global dictionary named 'solution'. This code must be a self-contained script that rebuilds necessary data (e.g., from the problem description) to ensure an unbiased check. You can use PuLP (model definition only), NumPy and Pandas.",
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
    .nullable()
    .describe('A summary of the solution, or null if a code error occurred.'),
  isError: z
    .boolean()
    .describe('Indicates if an error occurred during code execution.'),
  stdout: z
    .string()
    .optional()
    .describe('The standard output from the Python script.'),
  stderr: z
    .string()
    .optional()
    .describe(
      'The standard error from the Python script, which will contain tracebacks on failure.',
    ),
});

export const getSolutionOutputSchema = z.object({
  solution: z
    .object(solutionObjectSchemaObject)
    .describe('The complete solution object, including variable values.'),
});

export const validateSolutionOutputSchema = z.object({
  result: z
    .string()
    .describe('The JSON-serialized return value of the validateion script.'),
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
