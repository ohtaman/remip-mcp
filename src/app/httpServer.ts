// src/http-server.ts
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Logger } from 'pino';
import { randomUUID } from 'crypto';

export function setupAppServer(
  port: number,
  logger: Logger,
  mcpSessionFactory: (
    sessionIdGenerator: () => string,
    onSessionClosed: (sessionId: string) => void,
  ) => Promise<{
    transport: StreamableHTTPServerTransport;
    mcpServer: McpServer;
  }>,
) {
  const app = express();
  app.use(express.json());

  app.use((req, res, next) => {
    const start = process.hrtime.bigint();
    const reqId = (req.headers['x-request-id'] as string) ?? randomUUID();
    res.setHeader('x-request-id', reqId);
    // Use child logger
    req.log = logger.child({ req_id: reqId });

    res.on('finish', () => {
      const latency_ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
      req.log.info(
        {
          event: 'http_access',
          method: req.method,
          path: req.path,
          status: res.statusCode,
          latency_ms,
        },
        'http request',
      );
    });
    next();
  });

  app.get('/health', async (req, res) => {
    req.log?.info({ event: 'health_check' }, 'Health check OK');
    res.status(200).end();
  });

  const activeSessions = new Map<
    string,
    { transport: StreamableHTTPServerTransport; mcpServer: McpServer }
  >();

  const onSessionClosed = (sessionId: string) => {
    activeSessions.delete(sessionId);
    logger.info(
      { event: 'session_deleted', sessionId },
      'Deleted session from active pool',
    );
  };

  app.post('/mcp', async (req, res) => {
    try {
      const sessionId = req.headers['mcp-session-id'] as string;
      if (!sessionId) {
        let generatedSessionId = '';
        const sessionIdGenerator = () => {
          const newId = randomUUID();
          generatedSessionId = newId;
          return newId;
        };

        const { transport, mcpServer } = await mcpSessionFactory(
          sessionIdGenerator,
          onSessionClosed,
        );
        await transport.handleRequest(req, res, req.body);

        if (generatedSessionId) {
          activeSessions.set(generatedSessionId, { transport, mcpServer });
        } else {
          req.log?.error('Failed to generate session ID');
        }
      } else {
        const session = activeSessions.get(sessionId);
        if (session) {
          res.on('close', () => {
            logger.info(
              { event: 'sse_connection_closed', sessionId },
              'SSE connection closed, cleaning up session',
            );
            onSessionClosed(sessionId);
          });
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
      req.log?.error(
        { event: 'mcp_request_error', err },
        'Error handling MCP request',
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.delete('/mcp', async (req, res) => {
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
      req.log?.error(
        { event: 'mcp_request_error', err },
        'Error handling MCP request',
      );
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  app.get('/mcp', async (req, res) => {
    req.log?.info({ event: 'mcp_get_request' }, 'GET /mcp not allowed');
    res.writeHead(405).end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Method not allowed.' },
        id: null,
      }),
    );
  });

  app.listen(port, () => {
    logger.info(
      { event: 'server_listen', url: `http://localhost:${port}` },
      `Application server listening at http://localhost:${port}`,
    );
  });
}
