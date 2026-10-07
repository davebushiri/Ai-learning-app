// Starts server/index.js as a child process on a free port for tests.
//   const app = await startServer({ MOCK: '1' });
//   await fetch(app.url + '/api/health'); app.output(); await app.stop();

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../../server/index.js', import.meta.url));

export function startServer(env = {}) {
  const child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, PORT: '0', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  process.once('exit', () => child.kill()); // never leave a server behind if a test crashes
  let out = '';
  child.stdout.on('data', d => (out += d));
  child.stderr.on('data', d => (out += d));

  const stop = () => new Promise(resolve => {
    if (child.exitCode !== null || child.signalCode) return resolve();
    child.once('exit', resolve);
    child.kill();
  });

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { stop(); reject(new Error(`server did not start:\n${out}`)); }, 5000);
    const onExit = code => { clearTimeout(timer); reject(new Error(`server exited (${code}):\n${out}`)); };
    const onData = () => {
      const m = out.match(/on http:\/\/localhost:(\d+)/);
      if (!m) return;
      clearTimeout(timer);
      child.off('exit', onExit);
      child.stdout.off('data', onData);
      resolve({ url: `http://127.0.0.1:${m[1]}`, child, output: () => out, stop, alive: () => child.exitCode === null && !child.signalCode });
    };
    child.once('exit', onExit);
    child.stdout.on('data', onData);
  });
}
