import { loadPyodide, PyodideInterface } from 'pyodide';
import { logger } from './logger.js';

export class PyodideRunner {
  private sessionInstances: Map<string, Promise<PyodideInterface>> = new Map();
  private stdoutBuffer: Map<string, string> = new Map();
  private stderrBuffer: Map<string, string> = new Map();

  constructor(
    private pyodidePath: string,
    private defaultPackages: string[] = [],
    private micropipPackages: string[] = [],
  ) {}

  private initializeNewInstance(sessionId: string): Promise<PyodideInterface> {
    logger.info(
      { event: 'pyodide_init.start' },
      'Initializing new Pyodide instance...',
    );
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const pyodide = await loadPyodide({ indexURL: this.pyodidePath });
          pyodide.setStdout({
            batched: (str) =>
              this.stdoutBuffer.set(
                sessionId,
                (this.stdoutBuffer.get(sessionId) || '') + str + '\n',
              ),
          });
          pyodide.setStderr({
            batched: (str) =>
              this.stderrBuffer.set(
                sessionId,
                (this.stderrBuffer.get(sessionId) || '') + str + '\n',
              ),
          });

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
      this.sessionInstances.set(
        sessionId,
        this.initializeNewInstance(sessionId),
      );
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
    this.stdoutBuffer.set(sessionId, ''); // Clear buffers before run
    this.stderrBuffer.set(sessionId, '');
    try {
      const pyodide = await this.getSessionInstance(sessionId);
      const globals = pyodide.globals.get('dict')();
      if (options?.globals) {
        for (const [key, value] of Object.entries(options.globals)) {
          // Convert JS values to Python objects when possible to avoid JsProxy subscripting issues
          const pyValue =
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            typeof (pyodide as any).toPy === 'function'
              ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (pyodide as any).toPy(value)
              : value;
          globals.set(key, pyValue);
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

  public getOutput(sessionId: string): { stdout: string; stderr: string } {
    return {
      stdout: this.stdoutBuffer.get(sessionId) || '',
      stderr: this.stderrBuffer.get(sessionId) || '',
    };
  }
}
