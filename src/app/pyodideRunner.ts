import { loadPyodide, PyodideInterface } from 'pyodide';
import { logger } from './logger.js';

export class PyodideRunner {
  private pyodidePromise: Promise<PyodideInterface>;
  private sessions: Map<string, PyodideInterface> = new Map();

  constructor(
    pyodidePath: string,
    private defaultPackages: string[] = [],
    private micropipPackages: string[] = [],
  ) {
    this.pyodidePromise = this.initializePyodide(pyodidePath);
  }

  private async initializePyodide(
    pyodidePath: string,
  ): Promise<PyodideInterface> {
    logger.info({ event: 'pyodide_init.start' }, 'Initializing Pyodide...');
    const pyodide = await loadPyodide({ indexURL: pyodidePath });
    logger.info(
      { event: 'pyodide_init.load_packages' },
      'Loading default packages...',
    );
    await pyodide.loadPackage(['micropip', ...this.defaultPackages]);
    if (this.micropipPackages.length > 0) {
      logger.info(
        { event: 'pyodide_init.load_micropip_packages' },
        'Loading micropip packages...',
      );
      const micropip = pyodide.pyimport('micropip');
      await micropip.install(this.micropipPackages);
    }
    logger.info(
      { event: 'pyodide_init.end' },
      'Pyodide initialized successfully.',
    );
    return pyodide;
  }

  private async getSession(sessionId: string): Promise<PyodideInterface> {
    if (this.sessions.has(sessionId)) {
      return this.sessions.get(sessionId)!;
    }
    const pyodide = await this.pyodidePromise;
    const newSession = await pyodide.newSession();
    this.sessions.set(sessionId, newSession);
    return newSession;
  }

  public async run(
    sessionId: string,
    code: string,
    options?: { globals?: Record<string, unknown> },
  ): Promise<unknown> {
    logger.info(
      { event: 'pyodide_runner.run.start', sessionId, code },
      'Executing Python code',
    );
    try {
      const pyodide = await this.getSession(sessionId);
      if (options?.globals) {
        for (const [key, value] of Object.entries(options.globals)) {
          pyodide.globals.set(key, value);
        }
      }
      const result = await pyodide.runPythonAsync(code);
      logger.info(
        { event: 'pyodide_runner.run.success', sessionId, result },
        'Python code executed successfully',
      );
      return result;
    } catch (error) {
      logger.error(
        { err: error, code, sessionId },
        '[PyodideRunner] Error during Python execution',
      );
      throw error;
    }
  }

  public getOutput(): { stdout: string; stderr: string } {
    // This is a placeholder as direct stdout/stderr capture is complex with pyodide sessions.
    return { stdout: '', stderr: '' };
  }
}
