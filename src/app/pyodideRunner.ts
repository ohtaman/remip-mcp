
import { loadPyodide, PyodideInterface } from 'pyodide';

export class PyodideRunner {
  private pyodideInstances: Map<string, PyodideInterface> = new Map();
  private packages: string[];
  private indexURL: string;

  constructor(indexURL: string, packages: string[] = []) {
    this.indexURL = indexURL;
    this.packages = packages;
  }

  public async getPyodide(sessionId: string): Promise<PyodideInterface> {
    if (this.pyodideInstances.has(sessionId)) {
      return this.pyodideInstances.get(sessionId)!;
    }

    const pyodide = await loadPyodide({
      indexURL: this.indexURL,
      stdout: () => {},
      stderr: () => {},
    });
    if (this.packages.length > 0) {
      await pyodide.loadPackage(this.packages);
    }
    this.pyodideInstances.set(sessionId, pyodide);
    return pyodide;
  }

  public cleanup(sessionId: string): void {
    this.pyodideInstances.delete(sessionId);
  }
}
