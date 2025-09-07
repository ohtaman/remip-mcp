import { loadPyodide, PyodideInterface } from 'pyodide';

interface PyodideInstance {
  pyodide: PyodideInterface;
  stdout: string[];
  stderr: string[];
}

interface RunOptions {
  globals?: Record<string, unknown>;
}

export class PyodideRunner {
  private pyodideInstances: Map<string, PyodideInstance> = new Map();
  private packages: string[];
  private micropipPackages: string[];
  private indexURL: string;

  constructor(
    indexURL: string,
    packages: string[] = [],
    micropipPackages: string[] = [],
  ) {
    this.indexURL = indexURL;
    this.packages = packages;
    this.micropipPackages = micropipPackages;
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

    if (this.micropipPackages.length > 0) {
      await pyodide.loadPackage('micropip');
      const micropip = pyodide.pyimport('micropip');
      await micropip.install(this.micropipPackages);
    }

    this.pyodideInstances.set(sessionId, { pyodide, stdout, stderr });
    return pyodide;
  }

  public async run(
    sessionId: string,
    code: string,
    options: RunOptions = {},
  ): Promise<unknown> {
    const pyodide = await this.getPyodide(sessionId);
    if (options.globals) {
      for (const [key, value] of Object.entries(options.globals)) {
        pyodide.globals.set(key, value);
      }
    }
    return await pyodide.runPythonAsync(code);
  }

  public getOutput(sessionId: string): { stdout: string; stderr: string } {
    const instance = this.pyodideInstances.get(sessionId);
    if (!instance) {
      return { stdout: '', stderr: '' };
    }
    const result = {
      stdout: instance.stdout.join('\n'),
      stderr: instance.stderr.join('\n'),
    };
    // Clear buffers after getting the output
    instance.stdout.length = 0;
    instance.stderr.length = 0;
    return result;
  }

  public cleanup(sessionId: string): void {
    this.pyodideInstances.delete(sessionId);
  }
}
