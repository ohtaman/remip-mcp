
import { loadPyodide, PyodideInterface } from 'pyodide';

export class PyodideRunner {
  private pyodideInstances: Map<string, PyodideInterface> = new Map();

  public async getPyodide(sessionId: string): Promise<PyodideInterface> {
    if (this.pyodideInstances.has(sessionId)) {
      return this.pyodideInstances.get(sessionId)!;
    }

    const pyodide = await loadPyodide();
    this.pyodideInstances.set(sessionId, pyodide);
    return pyodide;
  }

  public cleanup(sessionId: string): void {
    this.pyodideInstances.delete(sessionId);
  }
}
