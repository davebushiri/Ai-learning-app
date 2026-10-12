// F1a-T08b (FR-024, FR-048, review B9): the gateway is the only place that calls the model,
// and the old server/llm.js wrapper has no importer left.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SKIP = new Set(['node_modules', '.git']);

function sourceFiles(dir) {
  const out = [];
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue;
    const rel = join(dir, e.name);
    if (e.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(m?js|cjs)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const rel = p => relative(ROOT, p).split('\\').join('/');

test('messages.create appears only in server/ai/gateway.js, which contains maxRetries: 1 and AbortSignal.timeout', () => {
  // Product code only: tests may name the method when they stub the client.
  const product = ['server', 'shared', 'scripts', 'web'].flatMap(sourceFiles);
  const callers = product.filter(f => /messages\s*\.\s*create\b/.test(readFileSync(join(ROOT, f), 'utf8'))).map(f => rel(join(ROOT, f)));
  assert.deepEqual(callers, ['server/ai/gateway.js']);
  const gateway = readFileSync(join(ROOT, 'server/ai/gateway.js'), 'utf8');
  assert.match(gateway, /maxRetries:\s*1\b/);
  assert.match(gateway, /AbortSignal\.timeout\(/);
});

test('no file imports server/llm.js', () => {
  const target = resolve(ROOT, 'server/llm.js');
  const files = ['server', 'shared', 'scripts', 'web', 'tests'].flatMap(sourceFiles);
  // Static `from '...'`, bare `import '...'` and dynamic `import('...')`.
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"]([^'"]+)['"]/g;
  const importers = [];
  for (const f of files) {
    const abs = join(ROOT, f);
    for (const [, spec] of readFileSync(abs, 'utf8').matchAll(re)) {
      if (spec.startsWith('.') && resolve(dirname(abs), spec) === target) importers.push(`${rel(abs)} -> ${spec}`);
    }
  }
  assert.deepEqual(importers, []);
});
