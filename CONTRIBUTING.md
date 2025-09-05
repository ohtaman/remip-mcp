# Contributing to remip-mcp

We welcome contributions to the `remip-mcp` project! Here's how you can help:

## Development Environment

*   **Coding Style:** The project uses TypeScript, ESLint, and Prettier to enforce a consistent coding style. A pre-commit hook is set up with Husky to automatically format and lint your code before you commit.
*   **Testing:** The project uses Jest for testing. You can run the tests with `npm test`.
*   **Directory Structure:**
    *   `src/`: Contains the main source code.
    *   `src/schemas/`: Defines the data schemas for inputs and outputs.
    *   `src/connectors/`: Contains client code for interacting with external services like the ReMIP solver.
*   **Commits:** No explicit commit message convention is specified. Please aim for clear and concise commit messages.

## How to Contribute

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and ensure tests pass.
4.  Submit a Pull Request.
