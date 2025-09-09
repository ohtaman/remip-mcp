import { spawn } from 'child_process';

describe('STDIO Server Transport', () => {
  it('should log a message about terminating the ReMIP process when stdin is closed', (done) => {
    // const child = spawn('node', ['dist/index.js', '--start-remip-server'], {
    const child = spawn('npm', ['run', 'dev', '--', '--start-remip-server'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    child.stderr.on('data', (data) => {
      output += data.toString();
    });

    child.on('exit', () => {
      expect(output).toContain('Terminating ReMIP server process');
      done();
    });

    // Simulate client disconnecting
    child.stdin.end();
  });
});
