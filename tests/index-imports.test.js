// F1a review S3: server/index.js must load .env (process.loadEnvFile) before any
// module that reads process.env at evaluation time (ai-client.js, llm.js, later
// ai/models.js). Static imports are hoisted above loadEnvFile, so the entry point
// may statically import only node: builtins and ./http.js; routes and services
// must come in through dynamic import().

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const INDEX = new URL('../server/index.js', import.meta.url);
const ALLOWED_LOCAL = new Set(['./http.js']);

// Specifiers of static `import ... from 'x'`, `import 'x'` and `export ... from 'x'`
// at statement start. Dynamic `import('x')` never matches: the keyword must be
// followed by whitespace and then a quote or a binding list without parentheses.
function staticSpecifiers(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const re = /(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  return [...code.matchAll(re)].map(m => m[1]);
}

test('server/index.js statically imports only node: builtins and ./http.js', () => {
  const specifiers = staticSpecifiers(readFileSync(INDEX, 'utf8'));
  assert.ok(specifiers.length > 0, 'parser found no static imports; the regex is broken');
  const disallowed = specifiers.filter(s => !s.startsWith('node:') && !ALLOWED_LOCAL.has(s));
  assert.deepEqual(disallowed, [], 'load these via dynamic import() after loadEnvFile');
});
