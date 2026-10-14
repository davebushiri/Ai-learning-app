// F1c-T05: pure client logic of the practice page (state.js, copy.js) and the
// structural guards on web/practice/** (FR-005, C8, C13, FR-039).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY } from '../web/practice/copy.js';
import { resumeIndex, feedbackText, dimLines, rubricLines, summaryLine, missedLine, newStopId, completeRequest } from '../web/practice/state.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WEB = path.join(ROOT, 'web');
const PRACTICE_DIR = path.join(WEB, 'practice');
const practiceFiles = () => [
  path.join(WEB, 'practice.html'),
  ...readdirSync(PRACTICE_DIR).map(f => path.join(PRACTICE_DIR, f))
];
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');

// Import specifiers: static import/export-from, bare `import 'x'`, dynamic import('x'),
// and <script src> / <link href> in HTML. Comments are stripped first.
function specifiers(file) {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const out = [];
  for (const m of src.matchAll(/(?:^|[;\n])\s*(?:import|export)\s+(?:[^'"();]*?\s+from\s+)?['"]([^'"]+)['"]/g)) out.push(m[1]);
  for (const m of src.matchAll(/\bimport\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g)) out.push(m[1]);
  for (const m of src.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/g)) out.push(m[1]);
  return out;
}

// Resolves a browser specifier to a repo path: '/x' is served from web/, '/shared/x' from shared/.
function resolveSpec(file, spec) {
  const url = new URL(spec, 'http://h/' + path.relative(WEB, file).split(path.sep).join('/'));
  const p = url.pathname;
  return p.startsWith('/shared/') ? 'shared/' + p.slice(8) : 'web' + p;
}

const STOP = (detection, overall, extra = {}) => ({
  statementId: 's4', attributedStatementId: detection === 'late_hit' ? 's3' : 's4', detection, assisted: false,
  result: overall ? { explanation: { status: overall, matched: [], missing: [] }, correction: { status: overall, matched: [], missing: [] }, overall } : null,
  reveal: overall ? { statementId: 's3', misconception: 'm', whyWrong: 'Because {hits} reasons.', exceptions: '', correctedText: 'Fixed.' } : null,
  ...extra
});

test('resume after hit is next; after late hit or false interruption is the interrupted statement', () => {
  assert.equal(resumeIndex(STOP('hit', 'met'), 2), 3);
  assert.equal(resumeIndex(STOP('late_hit', 'met'), 3), 3);
  assert.equal(resumeIndex(STOP('false_interruption', null), 1), 1);
});

test('feedbackText for each overall and late prefix', () => {
  const why = 'Because {hits} reasons.'; // pack text with braces is inserted once, never re-filled
  assert.equal(feedbackText(STOP('hit', 'met')), `Good catch. ${why}`);
  assert.equal(feedbackText(STOP('hit', 'partial')), `You caught it. Here's the full picture: ${why}`);
  assert.equal(feedbackText(STOP('hit', 'not_met')), `Right statement to stop on. Here's why it's wrong: ${why}`);
  assert.equal(feedbackText(STOP('hit', 'uncertain')), `Right statement to stop on. I can't score your answer reliably, so it's flagged for review. ${why}`);
  assert.equal(feedbackText(STOP('late_hit', 'met')), `That was the previous statement. Good catch. ${why}`);
  assert.equal(feedbackText(STOP('false_interruption', null)), 'That statement is accurate. Let\'s carry on.');
});

test('dimLines shows each dimension separately with its status label, uncertain honestly', () => {
  const result = {
    explanation: { status: 'uncertain', matched: [], missing: ['a'] },
    correction: { status: 'partial', matched: ['b'], missing: [] },
    overall: 'uncertain'
  };
  assert.deepEqual(dimLines(result), ['Explanation: Uncertain: flagged for review', 'Correction: Partly covered']);
  assert.deepEqual(dimLines(null), []);
});

test('rubricLines lists matched and missing items, alternatives shown with a slash', () => {
  assert.deepEqual(
    rubricLines({ status: 'partial', matched: ['heavier line|more weight'], missing: ['more drag'] }),
    ['Covered: heavier line / more weight', 'Not covered: more drag']
  );
});

test('summaryLine singular/plural', () => {
  const s = { planted: 2, hits: 1, lateHits: 1, misses: 0, falseInterruptions: 1, notReached: 0, cleanPass: false, flagged: 0 };
  assert.equal(summaryLine(s), 'Caught 2 of 2. Missed 0. Stopped on 1 accurate statement.');
  assert.equal(summaryLine({ ...s, falseInterruptions: 0 }), 'Caught 2 of 2. Missed 0. Stopped on 0 accurate statements.');
  assert.equal(summaryLine({ ...s, falseInterruptions: 3 }), 'Caught 2 of 2. Missed 0. Stopped on 3 accurate statements.');
  assert.equal(summaryLine({ ...s, planted: 0, hits: 0, lateHits: 0, falseInterruptions: 0, cleanPass: true }), COPY['end.clean']);
});

test('missedLine joins text, why and correction', () => {
  assert.equal(
    missedLine({ statementId: 's5', text: 'A line never wears out.', whyWrong: 'Sun weakens it.', correctedText: 'Lines wear out.' }),
    'Missed: A line never wears out. Sun weakens it. Corrected: Lines wear out.'
  );
});

// F1c-T14 (FR-009a, PD-5): a skipped stop is shown as not scored, never as a miss.
test('missedLine for a not-graded item says it was not scored and never says Missed', () => {
  const item = { statementId: 's3', text: 'A  line never\nwears out.', whyWrong: 'Sun weakens it.', correctedText: 'Lines wear out.', notGraded: true };
  const line = missedLine(item);
  assert.equal(line, 'Not scored, you skipped this stop: A line never wears out. Sun weakens it. Corrected: Lines wear out.');
  assert.doesNotMatch(line, /missed/i);
  // Only `notGraded === true` switches the copy; anything else stays a miss.
  assert.match(missedLine({ ...item, notGraded: 'true' }), /^Missed: /);
});

test('completeRequest sends skipped only when non-empty and lastStatementId only when known', () => {
  const skipped = [{ statementId: 's3', elapsedMs: 420 }];
  assert.deepEqual(completeRequest('s5', skipped), { lastStatementId: 's5', skipped });
  assert.deepEqual(completeRequest('s5', []), { lastStatementId: 's5' });
  assert.deepEqual(completeRequest(null, skipped), { skipped });
  assert.deepEqual(completeRequest(null, []), {});
  assert.deepEqual(completeRequest(undefined, undefined), {});
});

test('newStopId is unique per call and matches the server pattern', () => {
  const ids = Array.from({ length: 200 }, () => newStopId());
  for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{8,64}$/);
  assert.equal(new Set(ids).size, ids.length);
  // Fallback path: no randomUUID, so 16 random bytes as 32 lowercase hex chars.
  const saved = Object.getOwnPropertyDescriptor(globalThis.crypto, 'randomUUID')
    ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(globalThis.crypto), 'randomUUID');
  Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
  try {
    const a = newStopId(), b = newStopId();
    assert.match(a, /^[0-9a-f]{32}$/);
    assert.notEqual(a, b);
  } finally {
    delete globalThis.crypto.randomUUID;
    if (!('randomUUID' in globalThis.crypto)) Object.defineProperty(globalThis.crypto, 'randomUUID', saved);
  }
  assert.match(newStopId(), /^[0-9a-f-]{36}$/);
});

test('practice.html declares an empty inline icon', () => {
  const html = readFileSync(path.join(WEB, 'practice.html'), 'utf8');
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes('<link rel="icon" href="data:,">'));
});

test('copy strings equal the spec table', () => {
  // Frozen inline from spec.md "Spoken copy" (ids used by the text catch loop).
  const expected = {
    'picker.empty': 'No practice tracks are loaded.',
    'intro.catch': 'Listen for statements that are wrong. Say "stop", press Stop or press Space when you hear one. Some sets have no errors.',
    'prompt.stop': "What's wrong, and what should it say?",
    'fb.hit.met': 'Good catch. {whyWrong}',
    'fb.hit.partial': "You caught it. Here's the full picture: {whyWrong}",
    'fb.hit.not_met': "Right statement to stop on. Here's why it's wrong: {whyWrong}",
    'fb.hit.uncertain': "Right statement to stop on. I can't score your answer reliably, so it's flagged for review. {whyWrong}",
    'fb.late.prefix': 'That was the previous statement.',
    'fb.false': "That statement is accurate. Let's carry on.",
    'say.corrected': 'Corrected: {correctedText}',
    'btn.assist': 'Show the reference (counts as assisted)',
    'assist.spoken': 'The reference is on screen. Answers from here on count as assisted.',
    'end.catch': "That's the end of the set.",
    'sum.line': 'Caught {hits} of {planted}. Missed {misses}. Stopped on {f} accurate statement{s}.',
    'end.clean': "This set had no errors, and you didn't stop on any accurate statement. Well judged.",
    'missed.item': 'Missed: {text} {whyWrong} Corrected: {correctedText}',
    'status.met': 'Covered',
    'status.partial': 'Partly covered',
    'status.not_met': 'Not covered',
    'status.uncertain': 'Uncertain: flagged for review',
    'dim.explanation': 'Explanation',
    'dim.correction': 'Correction',
    'selfrate.prompt': 'Compare your answer with the reference. How did you do?',
    'selfrate.options': { had_it: 'I had it', partly: 'Partly', missed_it: 'I missed it' },
    'next.hint': 'Say "next" or press Next for the next exercise.',
    'btn.next': 'Next',
    'err.net': "Couldn't reach the server. Your answer is still here. Try again, or skip and this stop won't be scored.",
    'src.unverified': '(not yet verified)',
    'missed.notGraded': 'Not scored, you skipped this stop: {text} {whyWrong} Corrected: {correctedText}',
    'err.rate': "Couldn't save your rating. Try again.",
    'btn.retry': 'Try again'
  };
  assert.deepEqual({ ...COPY, 'selfrate.options': { ...COPY['selfrate.options'] } }, expected);
  assert.ok(Object.isFrozen(COPY) && Object.isFrozen(COPY['selfrate.options']));
});

test('no web/practice file imports server/ or mock-grader', () => {
  const bad = [];
  for (const f of practiceFiles()) {
    for (const s of specifiers(f)) {
      const r = resolveSpec(f, s);
      if (r.startsWith('web/server/') || r.startsWith('server/') || /mock-grader/.test(r)) bad.push(`${rel(f)} -> ${s}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('only web/practice/speech.js imports /speech.js', () => {
  const importers = [];
  for (const f of practiceFiles()) {
    for (const s of specifiers(f)) {
      const r = resolveSpec(f, s);
      if (r === 'web/speech.js' || r.startsWith('web/speech/')) importers.push(rel(f));
    }
  }
  assert.deepEqual([...new Set(importers)], ['web/practice/speech.js']);
  const facade = readFileSync(path.join(PRACTICE_DIR, 'speech.js'), 'utf8');
  for (const name of ['speak', 'stopSpeaking', 'wait', 'canListen', 'listen']) {
    assert.match(facade, new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*'/speech\\.js'`), name);
  }
});

test('sources are built with a.href by property and rel noopener noreferrer; no innerHTML in web/practice', () => {
  const app = readFileSync(path.join(PRACTICE_DIR, 'app.js'), 'utf8');
  assert.match(app, /\.href\s*=\s*\w/);
  assert.match(app, /\.rel\s*=\s*'noopener noreferrer'/);
  for (const f of practiceFiles()) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, rel(f));
    if (f.endsWith('.js')) assert.doesNotMatch(src, /setAttribute\(\s*['"]href/, rel(f));
  }
});

test('practice page stores nothing in the browser', () => {
  for (const f of practiceFiles()) {
    assert.doesNotMatch(readFileSync(f, 'utf8'), /localStorage|sessionStorage|indexedDB|document\.cookie/, rel(f));
  }
});
