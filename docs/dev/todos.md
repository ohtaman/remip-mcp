# TODOs

## Ghost Process on STDIO Disconnect

**Problem:**
When running the server with `--start-remip-server` and connecting via STDIO, disconnecting the client causes the main server process to exit but leaves the `uvx` and `remip` python processes running as orphans.

**Root Cause Analysis:**
1.  Disconnecting the STDIO client triggers the `'close'` event on `process.stdin`.
2.  The event handler for this in `src/index.ts` calls `process.exit(0)` directly.
3.  Crucially, this handler does **not** call `cleanupReMIPProcess()` before exiting.
4.  The main process terminates without sending any signal to the child `remip` process, leaving it and its children orphaned.

**Proposed Solution:**
Modify the `process.stdin.on('close', ...)` handler in `src/index.ts` to explicitly call the cleanup function before exiting.

```typescript
// src/index.ts

// ... inside the else block for stdio transport

process.stdin.on('close', () => {
  logger.info({ event: 'stdin_closed' }, 'STDIN closed, shutting down.');
  cleanupReMIPProcess(logger); // <-- Add this line
  process.exit(0);
});
```

---

## "Not Connected" Error on HTTP Disconnect

**Problem:**
When running the server with `--start-remip-server` and connecting via HTTP (the default for `mcp-inspector`), if the client disconnects while `solve_mip_problem` is running, the server transport throws a "Not connected" error. This can leave the server in a bad state, preventing future connections.

**Root Cause Analysis:**
1.  **Implicit Notifications via stdout:** The `ReMIPClient` is designed to log events (`log`, `metric`) directly to the console using its own logger instance.
2.  **Stdout Forwarding:** The MCP server transport captures anything written to the process's `stdout` and forwards it to the connected client. This is how the client currently receives solver logs.
3.  **Race Condition:** When a client disconnects, the HTTP connection is closed. However, the `remipClient.solve()` method continues to run in the background. When the ReMIP server sends another event, `ReMIPClient` logs it to `stdout`. The MCP transport tries to send this message to the now-disconnected client, causing the `Error: Not connected`.

**Proposed Solution:**
The fundamental issue is the reliance on `stdout` for notifications. The solution is to refactor the code to use the MCP SDK's explicit notification mechanism, which is connection-aware.

1.  **Refactor `ReMIPClient`:** Modify `ReMIPClient` to be an `EventEmitter`. Instead of logging events, it should `emit` them (e.g., `remipClient.emit('log', data)`).
2.  **Update `solveMipProblem`:**
    *   The `solveMipProblem` function must accept the `sendNotification` function, which is provided by the MCP server's `RequestHandlerExtra` object.
    *   Inside `solveMipProblem`, add event listeners for the `log` and `metric` events from the `ReMIPClient` instance.
    *   When an event is received, use the `sendNotification` function to send a properly formatted `LoggingMessageNotification` to the client. This function is aware of the connection state and will not throw an error if the client has disconnected.
3.  **Update `index.ts`:** Modify the `solve_mip_problem` tool registration to pass `extra.sendNotification` to the `solveMipProblem` function.
