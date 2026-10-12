// F1a-T10 (FR-037, FR-038, invariant 1): subject words must not appear in engine code.
// The allow-list baselines today's hits exactly as {file, word, count}; counts may only
// go down (the ratchet). Removing a hit means lowering the count in the same change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SCAN_DIRS = ['server', 'shared', 'web', 'scripts'];
const EXCLUDED = new Set(['packs', 'fixtures', 'tests', 'node_modules']);
const { words: WORDS } = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/deny-list.json'), 'utf8'));
const ALLOW = JSON.parse(readFileSync(join(ROOT, 'tests/fixtures/deny-list-allow.json'), 'utf8'));

// A word boundary is any non-[A-Za-z0-9_] char, so camelCase (fetchTrades) is not a hit
// but kebab-case (trade-select) is. Spaces in an entry match any run of whitespace.
function wordRegex(word) {
  const body = word.trim().split(/\s+/)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  return new RegExp(`(?<![A-Za-z0-9_])${body}(?![A-Za-z0-9_])`, 'gi');
}

function countHits(text, word) {
  return (text.match(wordRegex(word)) || []).length;
}

function listFiles(dir) {
  const out = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (EXCLUDED.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else if (e.isFile()) out.push(p);
  }
  return out;
}

function scan() {
  const hits = new Map(); // "file\0word" -> count
  for (const d of SCAN_DIRS) {
    for (const abs of listFiles(join(ROOT, d))) {
      const file = relative(ROOT, abs).split(sep).join('/');
      const text = readFileSync(abs, 'utf8');
      for (const word of WORDS) {
        const n = countHits(text, word);
        if (n > 0) hits.set(`${file}\0${word}`, n);
      }
    }
  }
  return hits;
}

const allowed = new Map(ALLOW.map((e) => [`${e.file}\0${e.word}`, e.count]));
const actual = scan();

test('no unlisted subject words in engine code', () => {
  const problems = [];
  for (const [key, n] of actual) {
    const [file, word] = key.split('\0');
    const limit = allowed.get(key) ?? 0;
    if (n > limit) {
      problems.push(allowed.has(key)
        ? `${file}: "${word}" found ${n}, allow-list permits ${limit} (counts only go down)`
        : `${file}: "${word}" found ${n}, not on the allow-list (allowed 0)`);
    }
  }
  assert.deepEqual(problems, [], `deny-listed subject words in engine code:\n${problems.join('\n')}`);
});

test('allow-list counts match exactly (shrink the list when you remove a word)', () => {
  const problems = [];
  const seen = new Set();
  for (const e of ALLOW) {
    const key = `${e.file}\0${e.word}`;
    if (seen.has(key)) problems.push(`${e.file}: "${e.word}" listed twice`);
    seen.add(key);
    if (!WORDS.includes(e.word)) problems.push(`${e.file}: "${e.word}" is not a deny-list word`);
    if (!Number.isInteger(e.count) || e.count < 1) problems.push(`${e.file}: "${e.word}" count ${e.count} must be an integer >= 1`);
    const n = actual.get(key) ?? 0;
    if (n !== e.count) {
      problems.push(`${e.file}: "${e.word}" allow-list says ${e.count}, actual is ${n}` +
        (n < e.count ? ' (lower the count, or remove the entry at 0)' : ''));
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

test('every deny-list word is listed once and FR-038 seed is present', () => {
  const seed = ['trade', 'trades', 'journeyman', 'electrical', 'electrician', 'hvac', 'automotive',
    'receptacle', 'breaker', 'gfci', 'gfi', 'backstab', 'nitrogen', 'nitro', 'refrigerant', 'braze',
    'brazing', 'extinguisher', 'caliper', 'jack stand', 'jackstand', 'de-energized', 'deenergized',
    'nec', 'osha', 'epa', 'jobsite', 'got hurt'];
  for (const w of seed) assert.ok(WORDS.includes(w), `seed word missing: ${w}`);
  assert.equal(new Set(WORDS.map((w) => w.toLowerCase())).size, WORDS.length, 'duplicate deny-list word');
  for (const w of ['apprentice', 'job', 'supervisor', 'step', 'mistake']) {
    assert.ok(!WORDS.includes(w), `engine concept word must not be deny-listed: ${w}`);
  }
});

test('matcher: word boundaries (fetchTrades is not a hit, trade-select is)', () => {
  assert.equal(countHits('fetchTrades()', 'trades'), 0);
  assert.equal(countHits('tradesman', 'trade'), 0);
  assert.equal(countHits('trades', 'trade'), 0);
  assert.equal(countHits('id="trade-select"', 'trade'), 1);
  assert.equal(countHits('a.trade, b_trade, trade_id', 'trade'), 1);
  assert.equal(countHits('connect necessary', 'nec'), 0);
  assert.equal(countHits('per NEC 210.8', 'nec'), 1);
  assert.equal(countHits('the de-energized panel', 'de-energized'), 1);
});

test('matcher: case-insensitive, multi-word phrases', () => {
  assert.equal(countHits('HVAC Hvac hvac', 'hvac'), 3);
  assert.equal(countHits('use a Jack  Stand and a jack\nstand', 'jack stand'), 2);
  assert.equal(countHits('jackstand', 'jack stand'), 0);
  assert.equal(countHits('he GOT\tHURT', 'got hurt'), 1);
});
