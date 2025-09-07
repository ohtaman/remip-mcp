import { Client, isTextContent } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SolutionObject, SolutionSummary } from '../../src/schemas/solutions';
import { Model } from '../../src/schemas/models';

describe('Full Workflow E2E Test', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npm',
      args: ['run', 'dev', '--', '--stdio'],
    });
    client = new Client({ name: 'e2e-test-client', version: '1.0.0' });
    await client.connect(transport);
    // Give server time to fully initialize pyodide
    await new Promise(resolve => setTimeout(resolve, 5000));
  }, 10000); // 10s timeout for setup

  afterAll(() => {
    transport.close();
  });

  it('should run the full workflow successfully', async () => {
    // 1. Check that packages are installed
    const checkResult = await client.callTool({ name: 'check_packages', arguments: {} });
    if (isTextContent(checkResult.content)) {
        const check = JSON.parse(checkResult.content[0].text);
        expect(check.status).toBe('ok');
    } else {
        fail('Expected text content from check_packages');
    }


    // 2. Define a model
    const modelCode = `
import pulp
import json

prob = pulp.LpProblem("test_problem", pulp.LpMaximize)
x = pulp.LpVariable("x", 0, 10)
prob += 2 * x, "objective"
prob += x <= data["limit"], "constraint"
`;
    const defineResult = await client.callTool({
      name: 'define_model',
      arguments: {
        model_name: 'test_model',
        model_code: modelCode,
        inputs: ['limit'],
      },
    });
    if (isTextContent(defineResult.content)) {
        expect(JSON.parse(defineResult.content[0].text)).toEqual({
          status: 'ok',
          model_name: 'test_model',
          model_type: 'pulp.LpProblem',
        });
    } else {
        fail('Expected text content from define_model');
    }


    // 3. List models
    const listResult = await client.callTool({ name: 'list_models', arguments: {} });
    if (isTextContent(listResult.content)) {
        const models = JSON.parse(listResult.content[0].text) as Model[];
        expect(models).toHaveLength(1);
        expect(models[0].name).toBe('test_model');
    } else {
        fail('Expected text content from list_models');
    }


    // 4. Solve the problem
    const solveResult = await client.callTool({
      name: 'solve_problem',
      arguments: {
        model_name: 'test_model',
        data: { limit: 5 },
      },
    });
    if (isTextContent(solveResult.content)) {
        const summary = JSON.parse(solveResult.content[0].text) as SolutionSummary;
        expect(summary.status).toBe('Optimal');
        expect(summary.objective_value).toBe(10);

        // 5. Get the full solution
        const getResult = await client.callTool({
          name: 'get_solution',
          arguments: {
            solution_id: summary.solution_id,
            include_zero_variables: true,
          },
        });
        if (isTextContent(getResult.content)) {
            const solution = JSON.parse(getResult.content[0].text) as SolutionObject;
            expect(solution.variables['x']).toBe(5);

            // 6. Process the solution
            const processCode = 'f"Result is {solution.get(\"variables\").get(\"x\")}"';
            const processResult = await client.callTool({
              name: 'process_solution',
              arguments: {
                solution_id: summary.solution_id,
                processing_code: processCode,
              },
            });
            if (isTextContent(processResult.content)) {
                expect(JSON.parse(processResult.content[0].text)).toBe('Result is 5');
            } else {
                fail('Expected text content from process_solution');
            }
        } else {
            fail('Expected text content from get_solution');
        }
    } else {
        fail('Expected text content from solve_problem');
    }
  }, 25000); // 25s timeout for the full test
});
