// F1a-T01a guardrail (thread 0004): node --test reports a failing todo test as passing, so an
// unmapped todo would hide a red acceptance test until the end of F1a. Every todo reason in
// tests/acceptance and tests/e2e must be the ID of the ticket that implements it.
//
// The scan reads source text. A todo whose reason isn't a string literal (true, a variable,
// shorthand), or a test.todo / it.todo / describe.todo call (which carries no reason), is a
// violation too, because its ticket can't be read from the source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TESTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIRS = ['acceptance', 'e2e'].map(d => path.join(TESTS, d));
const TICKET = /^F1[ac]-T\d\d[a-d]?$/; // F1c-T01a: F1c todos map to F1c tickets the same way
const WORD = 'to' + 'do'; // spelled in two parts so this file's own source has no match

// Reads the string literal that starts at src[i] (', " or `); null if there isn't one.
function literalAt(src, i) {
  const q = src[i];
  if (q !== "'" && q !== '"' && q !== '`') return null;
  let out = '';
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === '\\') { out += src[j + 1] ?? ''; j++; continue; }
    if (c === q) return q === '`' && out.includes('${') ? null : out;
    if (c === '\n' && q !== '`') return null;
    out += c;
  }
  return null;
}

const lineOf = (src, i) => src.slice(0, i).split('\n').length;

// Returns {reasons: [{reason, line}], violations: [string]} for one source text.
export function scanTodos(src) {
  const reasons = [];
  const violations = [];
  const check = (reason, at, what) => {
    if (reason === null) violations.push(`line ${lineOf(src, at)}: ${what} has no string-literal reason`);
    else if (!TICKET.test(reason)) violations.push(`line ${lineOf(src, at)}: ${what} reason ${JSON.stringify(reason)} does not match ${TICKET}`);
    else reasons.push({ reason, line: lineOf(src, at) });
  };

  // Property form: { <word>: 'F1a-T12' }
  for (const m of src.matchAll(new RegExp(`\\b${WORD}\\s*:\\s*`, 'g'))) {
    check(literalAt(src, m.index + m[0].length), m.index, `${WORD}:`);
  }
  // Shorthand property: { <word> } or { a, <word>, b }
  for (const m of src.matchAll(new RegExp(`[{,]\\s*${WORD}\\s*[,}]`, 'g'))) {
    violations.push(`line ${lineOf(src, m.index)}: shorthand ${WORD} property has no reason`);
  }
  // Calls: t.<word>('reason') sets a reason; test/it/describe/suite.<word>(name, fn) can't carry one.
  for (const m of src.matchAll(new RegExp(`\\b([A-Za-z_$][\\w$]*)\\.${WORD}\\s*\\(\\s*`, 'g'))) {
    if (['test', 'it', 'describe', 'suite'].includes(m[1])) {
      violations.push(`line ${lineOf(src, m.index)}: ${m[1]}.${WORD}() carries no ticket reason; use the option with a ticket ID`);
    } else {
      check(literalAt(src, m.index + m[0].length), m.index, `${m[1]}.${WORD}()`);
    }
  }
  return { reasons, violations };
}

function sourceFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : sourceFiles(p);
    return /\.(m?js)$/.test(name) ? [p] : [];
  });
}

test('every todo reason in tests/acceptance and tests/e2e matches /^F1[ac]-T\\d\\d[a-d]?$/', t => {
  const files = DIRS.flatMap(sourceFiles);
  assert.ok(files.some(f => f.endsWith(path.join('acceptance', 'F1a.test.js'))), 'tests/acceptance/F1a.test.js is scanned');
  const problems = [];
  const table = {};
  for (const file of files) {
    const rel = path.relative(TESTS, file);
    const { reasons, violations } = scanTodos(readFileSync(file, 'utf8'));
    problems.push(...violations.map(v => `${rel} ${v}`));
    for (const { reason } of reasons) table[reason] = (table[reason] ?? 0) + 1;
  }
  t.diagnostic(`open todos by ticket: ${JSON.stringify(Object.fromEntries(Object.entries(table).sort()))}`);
  assert.deepEqual(problems, []);
});

test('guardrail scanner: accepts ticket IDs with and without a suffix', () => {
  const src = `test('a', { ${WORD}: 'F1a-T12' }, f);\ntest('b', { ${WORD}: "F1a-T13b" }, f);\nt.${WORD}('F1a-T17d');\ntest('c', { ${WORD}: 'F1c-T04' }, f);`;
  const { reasons, violations } = scanTodos(src);
  assert.deepEqual(violations, []);
  // Property-form reasons are listed before call-form ones (scan order), so F1c-T04 precedes F1a-T17d.
  assert.deepEqual(reasons.map(r => r.reason), ['F1a-T12', 'F1a-T13b', 'F1c-T04', 'F1a-T17d']);
});

test('guardrail scanner: flags a bad reason, a non-literal reason, shorthand, and test.todo without a reason', () => {
  const cases = [
    `test('a', { ${WORD}: 'later' }, f);`,
    `test('a', { ${WORD}: 'F1a-T13' + 'b' }, f);`.replace(`'F1a-T13' + 'b'`, 'reason'),
    `test('a', { ${WORD}: true }, f);`,
    `test('a', { ${WORD}: 'F1a-T7' }, f);`,
    `test('a', { ${WORD}: 'F1a-T13e' }, f);`,
    `test('a', { ${WORD}: 'F1d-T01' }, f);`,
    `test('a', { ${WORD}: 'F1a-T12 and more' }, f);`,
    `test('a', { ${WORD}: \`F1a-\${n}\` }, f);`,
    `const ${WORD} = 'F1a-T12'; test('a', { ${WORD} }, f);`,
    `test.${WORD}('a', f);`,
    `t.${WORD}('soon');`
  ];
  for (const src of cases) {
    assert.ok(scanTodos(src).violations.length >= 1, `not flagged: ${src}`);
  }
});
