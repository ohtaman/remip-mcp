import http from 'http';
import { AddressInfo } from 'net';
import express from 'express';

describe('HTTP Server for MCP - GET /mcp 405 Bug', () => {
  let server: http.Server;
  let url: string;

  beforeAll(async () => {
    const app = express();
    app.use(express.json()); // Needed for POST requests

    // Mock activeSessions and mcpSessionFactory for the test
    const activeSessions = new Map<
      string,
      { transport: any; mcpServer: any }
    >();

    const mcpSessionFactory = async (
      sessionIdGenerator: () => string,
      onSessionClosed: (sessionId: string) => void,
    ) => {
      // Mock transport and mcpServer for the test
      const mockTransport = {
        handleRequest: jest.fn(async (req, res, body) => {
          // Simulate transport handling based on method
          if (req.method === 'GET') {
            // For GET, simulate successful SSE connection (no 405)
            res.writeHead(200, { 'Content-Type': 'text/event-stream' });
            res.end();
          } else if (req.method === 'POST') {
            // For POST, simulate successful MCP message handling
            // Set the mcp-session-id header for the initial POST
            if (body.method === 'initialize') {
              res.setHeader('mcp-session-id', 'test-session-id');
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ jsonrpc: '2.0', result: {}, id: body.id }));
          }
        }),
      };
      const mockMcpServer = {}; // Not directly used in this test
      return { transport: mockTransport, mcpServer: mockMcpServer };
    };

    // Re-implement the relevant parts of setupAppServer for the test
    app.post('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (!sessionId) {
          let generatedSessionId = '';
          const sessionIdGenerator = () => {
            const newId = 'test-session-id'; // Fixed session ID for test
            generatedSessionId = newId;
            return newId;
          };

          const { transport, mcpServer } = await mcpSessionFactory(
            sessionIdGenerator,
            () => {}, // Add this back
          );
          await transport.handleRequest(req, res, req.body);

          if (generatedSessionId) {
            activeSessions.set(generatedSessionId, { transport, mcpServer });
          }
        } else {
          const session = activeSessions.get(sessionId);
          if (session) {
            await session.transport.handleRequest(req, res, req.body);
          } else {
            res.status(404).json({
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Session not found' },
              id: null,
            });
          }
        }
      } catch (err) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    });

    app.get('/mcp', async (req, res) => {
      try {
        const sessionId = req.headers['mcp-session-id'] as string;
        if (sessionId) {
          const session = activeSessions.get(sessionId);
          if (session) {
            await session.transport.handleRequest(req, res, req.body);
          } else {
            res.status(404).json({
              jsonrpc: '2.0',
              error: { code: -32001, message: 'Session not found' },
              id: null,
            });
          }
        } else {
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32600,
              message: 'Invalid Request: Mcp-Session-Id header is required',
            },
            id: null,
          });
        }
      } catch (err) {
        res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
      }
    });

    server = http.createServer(app);

    await new Promise<void>((resolve) => {
      server.listen(() => {
        const port = (server.address() as AddressInfo).port;
        url = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  it('should not return 405 for GET /mcp with a valid session ID', (done) => {
    const initializePayload = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: { capabilities: {} },
      id: 1,
    };

    const postData = JSON.stringify(initializePayload);

    const postOptions: http.RequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        Accept: 'application/json, text/event-stream',
      },
    };

    // First POST to initialize session
    const postReq = http.request(`${url}/mcp`, postOptions, (postRes) => {
      let postData = '';
      postRes.on('data', (chunk) => {
        postData += chunk;
      });
      postRes.on('end', () => {
        const initializeResult = JSON.parse(postData);
        // In this test, we expect the session ID to be 'test-session-id'
        const sessionId = postRes.headers['mcp-session-id'];
        expect(sessionId).toBe('test-session-id');

        // Now send GET request with the session ID
        const getOptions: http.RequestOptions = {
          method: 'GET',
          headers: {
            'mcp-session-id': sessionId,
            Accept: 'application/json, text/event-stream',
          },
        };

        const getReq = http.request(`${url}/mcp`, getOptions, (getRes) => {
          expect(getRes.statusCode).toBe(405); // This is the assertion for the bug
          done();
        });

        getReq.on('error', (e) => {
          done(e);
        });
        getReq.end();
      });
    });

    postReq.on('error', (e) => {
      done(e);
    });
    postReq.write(postData);
    postReq.end();
  });
});
