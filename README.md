# ReMIP MCP Server

This project provides a Model Context Protocol (MCP) server that uses a Pyodide environment to model Mixed-Integer Programming (MIP) problems and solve them with a ReMIP (Remote MIP) API.

## Project Overview

This project is a Node.js server that implements the Model Context Protocol (MCP). It exposes tools to generate, solve, and process MIP problems.

The server is built with TypeScript and Express. It uses Pyodide to run Python code, specifically the `pulp` library, to define the optimization problem. The problem is then sent to a ReMIP (Remote MIP) solver service for solving.

The server supports streaming updates for logs and solver metrics back to the client as MCP notifications.

**Key Technologies:**
*   Node.js
*   TypeScript
*   Express
*   Model Context Protocol SDK (`@modelcontextprotocol/sdk`)
*   Pyodide
*   `pulp` (Python library for optimization modeling)

**Architecture:**
1.  An Express server listens for MCP requests.
2.  The `generate_mip_problem`, `solve_mip_problem`, and `process_mip_solution` tools are registered with the MCP server.
3.  When `generate_mip_problem` is called, it executes user-provided Python code using Pyodide to generate a problem definition.
4.  When `solve_mip_problem` is called, the problem is sent to a ReMIP server using the `ReMIPClient`.
5.  The `ReMIPClient` streams `log` and `metric` events back during the solving process.
6.  These events are relayed as MCP notifications to the client.
7.  Once the solution is found, it is returned as the result of the tool call.
8.  The `process_mip_solution` tool can be used to validate or analyze the solution using a Python script.

---

### Building and Running

**Prerequisites:**
*   Node.js
*   npm

**Installation:**
```bash
npm install
```

**Running the development server:**
This command starts the server with auto-reloading when source files change.
```bash
npm run dev
```

**Running the production server:**
First, build the TypeScript code:
```bash
npm run build
```
Then, start the server:
```bash
npm start
```
*Note: The `start` script uses `ts-node` which is generally not recommended for production. For a true production environment, you would run the compiled javascript: `node dist/index.js`.*

**Running the ReMIP backend server:**
The project requires a running ReMIP server. You can start a local one using the following command:
```bash
npm run remip-server
```

---

### Development Conventions

*   **Coding Style:** The project uses TypeScript and follows standard modern JavaScript/TypeScript conventions (e.g., ES Modules). Prettier or a similar code formatter is recommended.
*   **Testing:** A `test` script exists in `package.json` but it currently does nothing (`echo 1`). Testing appears to be a TODO.
*   **Directory Structure:**
    *   `src/`: Contains the main source code.
    *   `src/schemas/`: Defines the data schemas for inputs and outputs.
    *   `src/connectors/`: Contains client code for interacting with external services like the ReMIP solver.
*   **Commits:** No explicit commit message convention is specified.
