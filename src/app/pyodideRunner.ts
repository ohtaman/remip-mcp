import { loadPyodide, PyodideInterface } from 'pyodide';
import { logger } from './logger.js';

export class PyodideRunner {
  // Store a separate Pyodide instance promise for each session
  private sessionInstances: Map<string, Promise<PyodideInterface>> = new Map();

  constructor(
    private pyodidePath: string,
    private defaultPackages: string[] = [],
    private micropipPackages: string[] = [],
  ) {}

  private initializeNewInstance(): Promise<PyodideInterface> {
    logger.info(
      { event: 'pyodide_init.start' },
      'Initializing new Pyodide instance...',
    );
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const pyodide = await loadPyodide({ indexURL: this.pyodidePath });
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
            'New Pyodide instance initialized successfully.',
          );
          resolve(pyodide);
        } catch (error) {
          reject(error);
        }
      })();
    });
  }

  private getSessionInstance(sessionId: string): Promise<PyodideInterface> {
    if (!this.sessionInstances.has(sessionId)) {
      // If no instance exists for this session, create a new one.
      this.sessionInstances.set(sessionId, this.initializeNewInstance());
    }
    return this.sessionInstances.get(sessionId)!;
  }

  public async run(
    sessionId: string,
    code: string,
    options?: { globals?: Record<string, unknown> },
  ): Promise<unknown> {
    logger.info(
      { event: 'pyodide_runner.run.start', sessionId },
      'Executing Python code in session',
    );
    try {
      const pyodide = await this.getSessionInstance(sessionId);

      // While each session has its own runtime, we still create a fresh dict
      // for globals to be extra safe and prevent leaks between calls within the same session.
      const globals = pyodide.globals.get('dict')();
      if (options?.globals) {
        for (const [key, value] of Object.entries(options.globals)) {
          globals.set(key, value);
        }
      }

      const result = await pyodide.runPythonAsync(code, { globals });
      logger.info(
        { event: 'pyodide_runner.run.success', sessionId },
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
    return { stdout: '', stderr: '' };
  }
}
