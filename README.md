# ReMIP MCP Server

> 🚀 A powerful Model Context Protocol (MCP) server for solving Mixed-Integer Programming (MIP) problems with Pyodide and ReMIP.

[![CI](https://github.com/ohtaman/remip-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/ohtaman/remip-mcp/actions/workflows/ci.yml)

---

This project provides a service for modeling and solving Mixed-Integer Programming (MIP) problems. It is designed to be used as a tool within a larger system that follows the Model Context Protocol (MCP).

## 💡 What is this?

This is a server that gives you tools to solve complex optimization problems. You can define your problem using Python's `pulp` library, send it to the server, and get a solution back. The server handles the complicated parts of setting up the problem and communicating with the solver.

It's useful for anyone who needs to solve resource allocation, scheduling, or other optimization tasks without wanting to build the entire solving pipeline themselves.

---

## ⚡ Quick Start

To get the `remip-mcp` server up and running quickly:

1.  **Clone the repository:** ⬇️
    ```bash
    git clone https://github.com/ohtaman/remip-mcp.git
    cd remip-mcp
    ```
2.  **Install dependencies:** 📦
    ```bash
    npm install
    ```
3.  **Start the development server:** ▶️
    ```bash
    npm run dev
    ```
    This will start the server with auto-reloading.

4.  **Start the ReMIP backend server (required):** ⚙️
    In a separate terminal, run:
    ```bash
    npm run remip-server
    ```
    The `remip-mcp` server requires a running ReMIP backend to solve problems.

## ✨ Core Features

This server provides three main tools:

*   **`generate_mip_problem`**: 📝 Takes your Python code (using the `pulp` library) and transforms it into a JSON problem definition. This is the first step to solving your problem.
*   **`solve_mip_problem`**: ⚙️ Takes the problem file generated in the previous step and sends it to a powerful MIP solver. It streams live updates, so you can see the solver's progress in real-time.
*   **`process_mip_solution`**: 📊 Once you have a solution, this tool lets you run another Python script to validate, analyze, or format the results into a more human-readable format.

## 🧠 How It Works

The server is built with Node.js and uses a technology called **Pyodide** to safely run your Python code without you needing to install Python yourself.

```mermaid
sequenceDiagram
    participant User as User/Client
    participant Server as remip-mcp Server
    participant Pyodide as Pyodide
    participant ReMIP as ReMIP Solver

    User->>Server: Call generate_mip_problem (Python Code)
    Server->>Pyodide: Run Python Code
    Pyodide-->>Server: JSON Problem Definition
    Server-->>User: Problem ID

    User->>Server: Call solve_mip_problem (Problem ID)
    Server->>ReMIP: Send Problem
    ReMIP-->>Server: Stream Logs/Metrics
    ReMIP-->>Server: Solution
    Server-->>User: Solution

    User->>Server: Call process_mip_solution (Problem ID, Python Code)
    Server->>Pyodide: Process Solution
    Pyodide-->>Server: Processed Result
    Server-->>User: Processed Result
```

Here's a step-by-step breakdown of the process:

1.  You call the `generate_mip_problem` tool with your optimization model written in Python.
2.  The server runs your code and creates a JSON problem definition.
3.  You then pass this file to the `solve_mip_problem` tool.
4.  The server sends the problem to a **ReMIP (Remote MIP) solver**.
5.  As the solver works, it sends back logs and progress metrics, which you receive as notifications.
6.  Once finished, you get the final solution.
7.  You can then use `process_mip_solution` to work with the results.

## 🔌 Client Interaction and Command Line Arguments

This `remip-mcp` server exposes its tools via the Model Context Protocol. Clients can connect to this server to utilize its MIP solving capabilities. While the exact connection mechanism depends on the client application, a client might use a configuration similar to the following to define how it connects to and manages this server:

```json
{
  "mcpServers": {
    "remip-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "github:ohtaman/remip-mcp",
        "--start-remip-server"
      ]
    }
  }
}
```

*Note: This JSON is an example of a client-side configuration and is not processed by this `remip-mcp` server directly. It illustrates how a client might define the command to launch or manage this server.*

### Command Line Arguments

The `remip-mcp` server can be configured using the following command-line arguments when run directly (e.g., via `node dist/index.js` or `npx ...`).

*   **`--http`** (boolean)
    *   Enables the HTTP transport for the MCP server. When enabled, the server will listen for MCP requests over HTTP.
    *   Default: `false`
*   **`--port <number>`** (number)
    *   Specifies the port for the HTTP transport. This argument is only relevant when `--http` is enabled.
    *   Default: `8080`
*   **`--start-remip-server`** (boolean)
    *   If set, the `remip-mcp` server will attempt to start a local ReMIP backend server as a child process.
    *   Default: `false`
*   **`--remip-source-uri <string>`** (string)
    *   Specifies the source URI for the ReMIP server to be started. This is used when `--start-remip-server` is true.
    *   Default: `github:ohtaman/remip-server`
*   **`--remip-host <string>`** (string)
    *   Specifies the host of the ReMIP server that `remip-mcp` should connect to.
    *   Default: `localhost`
*   **`--remip-port <number>`** (number)
    *   Specifies the port of the ReMIP server that `remip-mcp` should connect to.
    *   Default: `8081`
*   **`--pyodide-packages <string[]>`** (array of strings)
    *   Provides a comma-separated list of additional Pyodide packages (e.g., `numpy,pandas`) to be installed and available in the Pyodide environment.
    *   Default: `[]`

**Example Usage:**

To start the `remip-mcp` server with HTTP transport on port 9000 and also start a local ReMIP server:

```bash
node dist/index.js --http --port 9000 --start-remip-server
```

To connect to an existing ReMIP server at `my-remip-host:8000` and enable HTTP transport:

```bash
node dist/index.js --http --remip-host my-remip-host --remip-port 8000
```

---

## 💻 Interacting with the Server via CLI

This server exposes its capabilities through specific tools that can be invoked by any MCP-compatible client, including conceptual CLI clients. Below are the tools, their expected arguments, and any important considerations or limitations.

### Tool: `generate_mip_problem` 📝

*   **Purpose**: Converts user-provided Python code (using the `pulp` library) into a problem definition that can be solved.
*   **Arguments**: ✅
    *   `problemDefinitionCode` (string, **required**): Your Python code defining the MIP problem.
*   **Limitations**: ⚠️
    *   The Python code must use the `pulp` library.
    *   It must define exactly one `pulp.LpProblem` instance.
    *   Standard Python syntax and `pulp` conventions apply.
*   **Conceptual CLI Example**:
    ```bash
    # Assuming 'mcp-cli' is your MCP client
    mcp-cli call generate_mip_problem --problemDefinitionCode "import pulp; prob = pulp.LpProblem('MyProblem', pulp.LpMaximize); x = pulp.LpVariable('x'); prob += x"
    ```

### Tool: `solve_mip_problem` ⚙️

*   **Purpose**: Solves a previously generated MIP problem using a ReMIP solver.
*   **Arguments**: ✅
    *   `problemId` (string, **required**): The ID of the problem generated by `generate_mip_problem`.
*   **Limitations**: ⚠️
    *   Requires a running ReMIP backend server.
    *   The `problemId` must correspond to a valid, existing problem definition on the server.
*   **Conceptual CLI Example**:
    ```bash
    mcp-cli call solve_mip_problem --problemId "your-problem-id-here"
    ```

### Tool: `process_mip_solution` 📊

*   **Purpose**: Processes the solution of a solved MIP problem using user-provided Python code.
*   **Arguments**: ✅
    *   `problemId` (string, **required**): The ID of the solved problem.
    *   `solutionProcessingCode` (string, **required**): Your Python code to process the solution.
*   **Limitations**: ⚠️
    *   The `problemId` must correspond to a valid, *solved* problem.
    *   The Python code will have access to the solution data.
*   **Conceptual CLI Example**:
    ```bash
    mcp-cli call process_mip_solution --problemId "your-problem-id-here" --solutionProcessingCode "print('Solution processed!')"
    ```

---

## 👨‍💻 For Developers

This section contains information for developers who want to contribute to or run this project locally.

### Building and Running 🛠️

**Prerequisites:**
*   Node.js
*   npm

**Installation:**
```bash
npm install
```

**Linting and Formatting:**
```bash
# Run the linter
npm run lint

# Automatically fix linting and formatting issues
npm run lint:fix
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



## 📄 License

This project is licensed under the Apache-2.0 License - see the [LICENSE](LICENSE) file for details.




