# Requirements

## 1. Functional Requirements

### 1.1. Core Functionality
- The system shall expose a Model Context Protocol (MCP) server.
- The server shall provide a suite of tools to generate, solve, and validate Mixed-Integer Programming (MIP) problems.

### 1.2. Tool: `generate_mip_problem`
- **Input:** Python code using the `pulp` library to define a MIP problem.
- **Action:**
    - Execute the code within a session-specific Pyodide environment to generate an `LpProblem` object.
    - Serialize the `LpProblem` object into a JSON format compatible with the ReMIP API, including support for SOS1 and SOS2 constraints.
    - Store the resulting JSON in a temporary storage location, associated with a new, unique `problem_id`.
- **Output:** The `problem_id`.

### 1.3. Tool: `solve_mip_problem`
- **Input:** A `problem_id`.
- **Action:**
    - Retrieve the problem JSON from temporary storage using the `problem_id`.
    - Send the problem to a ReMIP (Remote MIP) server for solving.
    - Store the returned solution in temporary storage, associated with a new, unique `solution_id`.
- **Output:** The `solution_id`.

### 1.4. Tool: `validate_mip_solution`
- **Input:** A `solution_id` and Python code for validation (e.g., using `pandas`).
- **Action:**
    - Retrieve the solution data from temporary storage using the `solution_id`.
    - Execute the validation code within a session-specific Pyodide environment against the solution data.
- **Output:** A validation report (e.g., status and message).

## 2. Non-Functional Requirements

### 2.1. Architecture
- **Stateless Application Servers:** The application servers must not hold state in memory between requests.
- **Transient State Management:** A shared temporary storage mechanism (e.g., Redis, in-memory store) shall be used to hold data (claim checks) for the duration of a multi-step operation.

### 2.2. Security
- **Session-Scoped Data:** All data held in temporary storage must be strictly partitioned by a session key. It must not be possible for one session to access data created by another session.
- **Execution Isolation:** Each session must be provided with its own unique Pyodide environment. Environments must not be reused across sessions to prevent data leakage.

### 2.3. Technology Stack
- **Backend:** Node.js, Express, TypeScript
- **Python Execution:** Pyodide
- **MIP Modeling:** `pulp` (Python library)
- **Data Analysis (for validation):** `pandas` (Python library)
- **Protocol:** Model Context Protocol (MCP)

### 2.4. Performance
- The server should handle large MIP models efficiently. The primary bottleneck is expected to be the MIP solver, not the server itself.
- The temporary storage mechanism should have low latency.