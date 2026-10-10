// F1a-B06 (fixed in F1a-T06): tests/helpers/server.mjs must not add a process 'exit' listener per
// server. Long runs (the golden harness starts 61) hit MaxListenersExceededWarning otherwise.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from './helpers/server.mjs';

test('12 servers started and stopped in sequence add at most one process exit listener and emit no MaxListenersExceededWarning', async () => {
  const warnings = [];
  const onWarning = w => warnings.push(w.name);
  process.on('warning', onWarning);
  const before = process.listenerCount('exit');
  try {
    for (let i = 0; i < 12; i++) {
      const app = await startServer({ MOCK: '1' });
      assert.equal((await fetch(app.url + '/api/health')).status, 200);
      await app.stop();
      assert.equal(app.alive(), false);
    }
    await new Promise(r => setImmediate(r)); // warnings are emitted on a later tick
    assert.ok(process.listenerCount('exit') - before <= 1, `exit listeners grew by ${process.listenerCount('exit') - before}`);
    assert.deepEqual(warnings.filter(w => w === 'MaxListenersExceededWarning'), []);
  } finally {
    process.off('warning', onWarning);
  }
});
