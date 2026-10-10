// F1a-T03a: the golden harness must keep working while F1a moves and deletes
// product files (thread 0004, architect ruling on isolation). At replay it may
// read only tests/golden/** and tests/fixtures/golden/**, and it may start the
// server only through tests/helpers/server.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('..', import.meta.url));
const GOLDEN_DIR = path.join(REPO, 'tests', 'golden');
const PRODUCT_DIRS = ['fixtures', 'packs', 'server', 'shared'];

const goldenFiles = () => readdirSync(GOLDEN_DIR).filter(f => /\.(m?js|json)$/.test(f)).sort();
const source = f => readFileSync(path.join(GOLDEN_DIR, f), 'utf8');

// Every path-like token that mentions one of the product dirs followed by "/".
// Relative tokens ("../x/") are resolved from tests/golden/; bare or absolute
// tokens are taken from the repo root. A token is a violation when it lands in
// a product dir, so "../fixtures/golden/" (= tests/fixtures/golden/) is fine
// and "../../fixtures/scenarios", "fixtures/x" or "/shared/x.js" are not.
function productPaths(text) {
  const hits = [];
  const re = new RegExp(`[\\w./-]*\\b(?:${PRODUCT_DIRS.join('|')})/[\\w./-]*`, 'g');
  for (const [token] of text.matchAll(re)) {
    const abs = token.startsWith('.') ? path.resolve(GOLDEN_DIR, token) : path.resolve(REPO, token.replace(/^\/+/, ''));
    const rel = path.relative(REPO, abs).split(path.sep);
    if (PRODUCT_DIRS.includes(rel[0])) hits.push(token);
  }
  return hits;
}

test('the path scanner flags product paths and allows tests/fixtures/golden', () => {
  assert.deepEqual(productPaths(`new URL('../fixtures/golden/', import.meta.url)`), []);
  assert.deepEqual(productPaths(`'tests/fixtures/golden/runs'`), []);
  assert.deepEqual(productPaths(`'../helpers/server.mjs'`), []);
  assert.deepEqual(productPaths(`readFile('../../fixtures/scenarios/x.json')`), ['../../fixtures/scenarios/x.json']);
  assert.deepEqual(productPaths(`'packs/demo-trades/pack.json'`), ['packs/demo-trades/pack.json']);
  assert.deepEqual(productPaths(`import('/shared/scoring.js')`), ['/shared/scoring.js']);
  assert.deepEqual(productPaths(`'../../server/prompts/trades.js'`), ['../../server/prompts/trades.js']);
});

test('no file in tests/golden/ contains a path string under fixtures/, packs/, server/ or shared/', () => {
  const files = goldenFiles();
  assert.ok(files.includes('run.mjs') && files.includes('harness.mjs') && files.includes('scripts.mjs') && files.includes('browser-stubs.js'), `golden files: ${files}`);
  const found = files.flatMap(f => productPaths(source(f)).map(p => `${f}: ${p}`));
  assert.deepEqual(found, []);
});

test('the harness spawns the server only through tests/helpers/server.mjs', () => {
  assert.match(source('harness.mjs'), /import\s*\{\s*startServer\s*\}\s*from\s*'\.\.\/helpers\/server\.mjs'/);
  for (const f of goldenFiles()) {
    const text = source(f);
    assert.doesNotMatch(text, /index\.js/, `${f} names the server entry point`);
    assert.doesNotMatch(text, /\b(spawn|spawnSync|fork|exec|execSync|execFile)\s*\(/, `${f} starts a process`);
    // The only child process allowed is `git rev-parse HEAD` for manifest.gitSha.
    for (const m of text.matchAll(/\bexecFileSync\s*\(\s*([^,]+),/g)) assert.equal(m[1].trim(), "'git'", `${f} runs ${m[1]}`);
    if (f !== 'harness.mjs') assert.doesNotMatch(text, /\bstartServer\b/, `${f} starts the server itself`);
  }
});
