// Starts server/index.js as a child process on a free port for tests.
//   const app = await startServer({ MOCK: '1' });
//   await fetch(app.url + '/api/health'); app.output(); await app.stop();

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ENTRY = fileURLToPath(new URL('../../server/index.js', import.meta.url));

// Never leave a server behind if a test crashes. One shared 'exit' listener for every child,
// not one per server, so long runs don't pile up listeners (F1a-B06).
const live = new Set();
let exitHooked = false;

export function startServer(env = {}) {
  const child = spawn(process.execPath, [ENTRY], {
    // Each spawned server gets its own in-memory DB unless the caller names one (ADR 0001).
    env: { ...process.env, PORT: '0', DB_PATH: ':memory:', ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  live.add(child);
  child.once('exit', () => live.delete(child));
  if (!exitHooked) {
    exitHooked = true;
    process.on('exit', () => { for (const c of live) c.kill(); });
  }
  let out = '';
  child.stdout.on('data', d => (out += d));
  child.stderr.on('data', d => (out += d));

  const stop = () => new Promise(resolve => {
    live.delete(child);
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
