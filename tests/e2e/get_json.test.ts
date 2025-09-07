import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

describe('Get Model JSON', () => {
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    transport = new StdioClientTransport({
      command: 'npm',
      args: ['run', 'dev', '--', '--stdio'],
    });
    client = new Client({ name: 'e2e-test-client', version: '1.0.0' });
    await client.connect(transport);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }, 10000);

  afterAll(() => {
    transport.close();
  });

  it('should get the model json', async () => {
    const modelCode = `
from pulp import *
model = LpProblem("FurnitureProduction", LpMaximize)
tables = LpVariable("Tables", 0, None, LpInteger)
chairs = LpVariable("Chairs", 0, None, LpInteger)
bookcases = LpVariable("Bookcases", 0, None, LpInteger)
model += 40 * tables + 30 * chairs + 45 * bookcases, "Total Profit"
model += 2 * tables + 1 * chairs + 2.5 * bookcases <= 60, "Labour Constraint"
model += 0.8 * tables + 0.6 * chairs + 1.0 * bookcases <= 16, "Machine Constraint"
model += 30 * tables + 20 * chairs + 30 * bookcases <= 400, "Wood Constraint"
`;
    const result = await client.callTool({
      name: 'get_model_json',
      arguments: { code: modelCode },
    });
    const content = result.content as any;
    console.log(content[0].text);
  }, 15000);
});
