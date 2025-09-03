
import { loadPyodide, PyodideInterface } from 'pyodide';

export interface PyodideExecutionResult {
  stdout: string;
  stderr: string;
  result: any;
}

interface PyodideInstance {
  pyodide: PyodideInterface;
  stdout: string[];
  stderr: string[];
}

export class PyodideRunner {
  private pyodideInstances: Map<string, PyodideInstance> = new Map();
  private packages: string[];
  private indexURL: string;

  constructor(indexURL: string, packages: string[] = []) {
    this.indexURL = indexURL;
    this.packages = packages;
  }

  public async getPyodide(sessionId: string): Promise<PyodideInterface> {
    if (this.pyodideInstances.has(sessionId)) {
      return this.pyodideInstances.get(sessionId)!.pyodide;
    }

    const stdout: string[] = [];
    const stderr: string[] = [];
    const pyodide = await loadPyodide({
      indexURL: this.indexURL,
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    });

    if (this.packages.length > 0) {
      await pyodide.loadPackage(this.packages);
    }

    this.pyodideInstances.set(sessionId, { pyodide, stdout, stderr });
    return pyodide;
  }

  public getOutput(sessionId: string): { stdout: string; stderr: string } {
    const instance = this.pyodideInstances.get(sessionId);
    if (!instance) {
      return { stdout: '', stderr: '' };
    }
    const result = { stdout: instance.stdout.join('\n'), stderr: instance.stderr.join('\n') };
    // Clear buffers after getting the output
    instance.stdout.length = 0;
    instance.stderr.length = 0;
    return result;
  }

  public cleanup(sessionId: string): void {
    this.pyodideInstances.delete(sessionId);
  }
}
