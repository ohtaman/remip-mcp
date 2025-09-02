# Todo List

This document outlines the tasks required to implement the MIP solver application based on the requirements and design documents.

## High-Level Tasks

- [x] **Implement MCP Server:** Set up an Express server that speaks the Model Context Protocol.
- [x] **Implement `generate_mip_problem` tool:** This tool takes Python code, runs it in Pyodide, and stores the resulting problem description.
- [x] **Implement `solve_mip_problem` tool:** This tool takes a problem ID, retrieves the problem, sends it to the ReMIP solver, and stores the solution.
- [x] **Implement `validate_mip_solution` tool:** This tool takes a solution ID and validation code, retrieves the solution, and runs the validation.
- [x] **Implement Storage Service:** A service for temporary storage of problems and solutions (Claim Check Pattern).
- [x] **Implement Pyodide Runner:** A manager for Pyodide environments, ensuring session isolation.

## Detailed Breakdown

### MCP Server (`src/index.ts`)

- [x] Initialize Express server.
- [x] Register `generate_mip_problem` tool.
- [x] Register `solve_mip_problem` tool.
- [x] Register `validate_mip_solution` tool.
- [x] Extract `session_id` from incoming requests.

### Storage Service (`src/app/storage.ts`)

- [x] Create the `storage.ts` file.
- [x] Implement `get`, `set`, `delete` functions.
- [x] Ensure keys are namespaced by `session_id`.
- [x] Choose an underlying implementation (`node-cache` is a good starting point).

### Pyodide Runner (`src/app/pyodideRunner.ts`)

- [x] Create the `pyodideRunner.ts` file.
- [x] Implement a mechanism to manage a pool of Pyodide instances.
- [x] Map instances to `session_id`.
- [x] Ensure environments are not shared between sessions.

### Tool: `generate_mip_problem` (`src/tools/generateMipProblem.ts`)

- [x] Create the `generateMipProblem.ts` file.
- [x] Define the tool's schema (input: `problemDefinitionCode`, output: `problemId`).
- [x] Get a Pyodide instance from the `pyodideRunner`.
- [x] Execute the user's Python code.
- [x] Serialize the `LpProblem` object to JSON.
- [x] Store the JSON using the `StorageService`.
- [x] Return the `problem_id`.

### Tool: `solve_mip_problem` (`src/tools/solveMipProblem.ts`)

- [x] Create the `solveMipProblem.ts` file.
- [x] Define the tool's schema (input: `problemId`, output: `solutionId`).
- [x] Retrieve the problem JSON from `StorageService` using `problem_id`.
- [x] Use `ReMIPClient` to solve the problem.
- [x] Store the solution using `StorageService`.
- [x] Return the `solution_id`.

### Tool: `validate_mip_solution` (`src/tools/validateMipSolution.ts`)

- [x] Create the `validateMipSolution.ts` file.
- [x] Define the tool's schema (input: `solutionId`, `validationCode`, output: `status`, `message`).
- [x] Retrieve the solution from `StorageService` using `solution_id`.
- [x] Get a Pyodide instance from the `pyodideRunner`.
- [x] Execute the validation code.
- [x] Return the validation result.
