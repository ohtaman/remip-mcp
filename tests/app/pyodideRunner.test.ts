
import { PyodideRunner } from '@app/pyodideRunner';

describe('PyodideRunner', () => {
  let runner: PyodideRunner;

  beforeEach(() => {
    runner = new PyodideRunner('dummy-url');
  });

  it('should get a pyodide instance for a session', async () => {
    const sessionId = 'session1';
    const pyodide = await runner.getPyodide(sessionId);
    expect(pyodide).toBeDefined();
  });

  it('should get the same instance for the same session', async () => {
    const sessionId = 'session1';
    const pyodide1 = await runner.getPyodide(sessionId);
    const pyodide2 = await runner.getPyodide(sessionId);
    expect(pyodide1).toBe(pyodide2);
  });

  it('should get different instances for different sessions', async () => {
    const sessionId1 = 'session1';
    const sessionId2 = 'session2';
    const pyodide1 = await runner.getPyodide(sessionId1);
    const pyodide2 = await runner.getPyodide(sessionId2);
    expect(pyodide1).not.toBe(pyodide2);
  });

  it('should cleanup a pyodide instance', async () => {
    const sessionId = 'session1';
    const pyodide = await runner.getPyodide(sessionId);
    runner.cleanup(sessionId);
    const pyodide2 = await runner.getPyodide(sessionId);
    expect(pyodide).not.toBe(pyodide2);
  });
});
