# Design Document

## 1. Architecture

The system is a Node.js application that implements the Model Context Protocol (MCP). It provides tools to generate, solve, and validate Mixed-Integer Programming (MIP) problems.

To handle potentially large problem and solution data without consuming the client's (LLM's) context window, the architecture uses the **Claim Check Pattern**. Instead of passing large data back to the client, the server stores the data in a **temporary storage service** and returns a small, unique ID (a "ticket" or "claim check"). This allows for a multi-step workflow that is compatible with a stateless and scalable server architecture.

### 1.1. Architectural Principles

*   **Stateless Application Servers:** The application servers hold no data in their own memory between requests, allowing for horizontal scaling and high resilience.
*   **Transient State Management:** All temporary data required for a multi-step operation is managed by a shared `StorageService`.
*   **Security:** All stored data is strictly partitioned by a `session_id`. A ticket generated in one session cannot be accessed by another.
*   **Execution Isolation:** Python code execution occurs within a Pyodide environment that is created for and dedicated to a single session. Environments are never reused across sessions.

### 1.2. Workflow

1.  The client calls `generate_mip_problem`. The MCP Server SDK automatically associates a `session_id` with the request.
2.  The server generates the large problem JSON within a session-specific Pyodide instance. It uses the `StorageService` to save this JSON, which returns a unique `problem_id`.
3.  The server returns only the `problem_id` to the client.
4.  The client calls `solve_mip_problem`, providing the `problem_id`.
5.  The server uses the `StorageService` (providing both `session_id` and `problem_id`) to retrieve the problem JSON.
6.  The problem is sent to the ReMIP solver.
7.  The server receives the solution, stores it using the `StorageService` to get a new `solution_id`, and returns the `solution_id`.
8.  The client calls `validate_mip_solution` with the `solution_id` and validation code. The server retrieves the solution via the `StorageService` and runs the final step.

### 1.3. Mermaid Diagram

```mermaid
graph TD
    subgraph Client (LLM)
        A[User] -- provides PuLP code --> B
        B(Call generate_mip_problem) --> C{MCP Server}
        C -- returns problem_id --> D
        D(Call solve_mip_problem with problem_id) --> C
        C -- returns solution_id --> E
        E(Call validate_mip_solution with solution_id) --> C
    end

    subgraph MCP Server
        C -- reads/writes --> F[(Storage Service)]
        C -- sends problem / gets solution --> G{ReMIP Server}
        C -- uses --> H{Pyodide Runner}
    end

    style F fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#ccf,stroke:#333,stroke-width:2px
```

## 2. Components

### 2.1. MCP Server (`src/index.ts`)
- Initializes the Express server.
- Registers the three tools: `generate_mip_problem`, `solve_mip_problem`, and `validate_mip_solution`.
- Extracts the `session_id` from incoming requests.

### 2.2. Tool Definitions (`src/tools/`)
- **`generateMipProblem.ts`**: Orchestrates problem generation and storage.
- **`solveMipProblem.ts`**: Orchestrates problem retrieval and solving.
- **`validateMipSolution.ts`**: Orchestrates solution retrieval and validation.

### 2.3. Storage Service (`src/app/storage.ts` - to be created)
- Provides an interface for `get`, `set`, and `delete` operations for transient data. This is the implementation of the "Claim Check" storage.
- It is NOT a performance cache. It is a functional requirement.
- Internally, it can use `node-cache` or `redis`.
- **All keys are automatically namespaced with the `session_id` to ensure data isolation.** For example, `get(sessionId, problemId)` would look for a key like `sessionId:problemId`.

### 2.4. Pyodide Runner (`src/app/pyodideRunner.ts`)
- Manages the lifecycle of Pyodide environments.
- It will maintain a pool of Pyodide instances, with each instance mapped to a `session_id`.
- When a request comes in, it provides the appropriate Pyodide instance for that session, creating a new one if it doesn't exist.
- **Environments are never shared between sessions.**

### 2.5. ReMIP Client (`src/connectors/remip/ReMIPClient.ts`)
- Unchanged. Called by the `solve` tool.

## 3. Data Flow and Schemas

### 3.1. Tool Schemas

**`generate_mip_problem`**
- **Input:** `{ "problemDefinitionCode": "..." }`
- **Output:** `{ "problemId": "unique-problem-id" }`

**`solve_mip_problem`**
- **Input:** `{ "problemId": "unique-problem-id" }`
- **Output:** `{ "solutionId": "unique-solution-id" }`

**`validate_mip_solution`**
- **Input:** `{ "solutionId": "unique-solution-id", "validationCode": "..." }`
- **Output:** `{ "status": "success" | "failure", "message": "..." }`
", "message": "..." }`
