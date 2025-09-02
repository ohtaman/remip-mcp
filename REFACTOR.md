# Refactoring Plan

This document outlines a plan to refactor the project into a more common and organized package/directory structure.

## Current Structure

The current `src` directory is relatively flat:

```
src/
├───__tests__/
├───connectors/
│   └───remip/
│       ├───ReMIPClient.ts
│       └───types.ts
├───schemas/
│   └───solutions.ts
├───tools/
│   └───solve-mip.ts
├───utils/
├───config.ts
├───http-server.ts
├───index.ts
├───logger.ts
└───remip-process.ts
```

## Proposed Structure

The proposed structure organizes files by their function, which is a common practice in Node.js projects. This improves maintainability and scalability.

```bash
.
├── dist/                     # Compiled JS files (no change)
├── node_modules/
├── src/
│   ├── app/                  # ★ Application setup, core infrastructure
│   │   ├── config.ts
│   │   ├── httpServer.ts     # (Recommended) Unify filenames to camelCase
│   │   ├── logger.ts
│   │   └── remipProcess.ts   # (Recommended) Unify filenames to camelCase
│   │
│   ├── connectors/           # External service integration (no change)
│   │   └── remip/
│   │       ├── ReMIPClient.ts
│   │       └── types.ts
│   │
│   ├── schemas/              # Shared data structures (no change)
│   │   └── solutions.ts
│   │
│   ├── tools/                # Business logic (MCP tools)
│   │   └── solveMip.ts       # (Recommended) Unify filenames to camelCase
│   │
│   └── index.ts              # Application entry point (control tower)
│
├── tests/                    # ★ Isolate test files at the top level
│   └── tools/
│       └── solveMip.test.ts  # Mirror the 'src' structure
│
├── .env                      # (Recommended) Define environment variables
├── .gitignore
├── jest.config.ts
├── package.json
├── README.md                 # (Recommended) Project description
└── tsconfig.json
```

## File Migration Plan

| Old Path                                | New Path                                | Notes                               |
| --------------------------------------- | --------------------------------------- | ----------------------------------- |
| `src/config.ts`                         | `src/app/config.ts`                     | Centralized configuration.          |
| `src/http-server.ts`                    | `src/app/httpServer.ts`                 | Separates server setup from route handling. |
| `src/index.ts`                          | `src/index.ts`                          | `index.ts` as the application entry point. |
| `src/logger.ts`                         | `src/app/logger.ts`                     | Logger is part of the app infrastructure. |
| `src/schemas/solutions.ts`              | `src/schemas/solutions.ts`              | `src/models.ts` was merged into this file. |
| `src/remip-process.ts`                  | `src/app/remipProcess.ts`               | ReMIP process management is part of the app infrastructure. |
| `src/connectors/remip/ReMIPClient.ts`   | `src/connectors/remip/ReMIPClient.ts`   | No change.                          |
| `src/connectors/remip/types.ts`         | `src/connectors/remip/types.ts`         | No change.                          |
| `src/tools/solve-mip.ts`                | `src/tools/solveMip.ts`                 | Rename to camelCase.                |
| `src/__tests__/math.test.ts`            | (deleted)                               | This file has been deleted.         |

## Justification

*   **Separation of Concerns:** The new structure separates different aspects of the application (application setup, connectors, schemas, tools), making the codebase easier to understand and maintain.
*   **Scalability:** This structure is more scalable. As the application grows, new features can be added by creating new files in the appropriate directories.
*   **Clarity:** The role of each file is clearer from its location in the directory structure.
*   **Consistency:** This structure is consistent with common practices in the Node.js/TypeScript community.
*   **Test Isolation:** Moving the `tests` directory to the top level separates test code from source code, which is a standard best practice.

## TDD Refactoring Process

To ensure the refactoring is done safely and without breaking existing functionality, we will follow a Test-Driven Development (TDD) approach.

1.  **Choose a Module to Refactor:** Select a file to move and refactor (e.g., `src/config.ts`).
2.  **Create a Test File:** Create a corresponding test file in the new `tests` directory (e.g., `tests/app/config.test.ts`).
3.  **Write a Failing Test:** In the test file, write a simple test that imports the module from its *new, proposed location* and checks a piece of its functionality.
    *   This test **must fail** initially because the file isn't in the new location yet. This confirms your test setup is working correctly.
    *   Example for `config.ts`:
        ```typescript
        // tests/app/config.test.ts
        import { defaultConfig } from '../../src/app/config'; // Importing from the future location

        describe('AppConfig', () => {
          it('should have a default port', () => {
            expect(defaultConfig.port).toBe(3000);
          });
        });
        ```
4.  **Move and Refactor the Module:** Move the original file (`src/config.ts`) to its new location (`src/app/config.ts`). If the plan includes renaming, do that as well.
5.  **Run the Test:** Execute the test command (e.g., `npm test`). The test should now **pass**. This verifies two things:
    *   The file has been moved correctly.
    *   The core functionality checked by the test is still working.
6.  **Update Imports:** With the test passing, you can now safely update all other files in the `src` directory that were importing the moved file.
7.  **Repeat:** Repeat steps 1-6 for all other files in the migration plan.

This iterative "Red-Green-Refactor" cycle ensures that each change is small, verifiable, and safe.

## Next Steps

1.  Create the new directories: `src/app` and `tests`.
2.  Move the files according to the migration plan.
3.  Rename files to use camelCase.
4.  Update all `import` statements to reflect the new file paths.
5.  Update `jest.config.ts` to point to the new `tests` directory.
