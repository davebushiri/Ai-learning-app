// F1c-T11: the reviewed module-1 content in packs/applied-ai (spec "Exercise schema", C12, PD-1, PD-11).
// The pack is a format-only copy of docs/research/applied-ai/module-1/ (read here, never edited).
// These tests compare structure and ids only; they never print narration, keys or rubrics, because
// the founder is the learner.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../server/db.js';
import { loadPacks, listSubjects } from '../server/packs.js';
import { validatePracticePack, loadPracticePacks, listTracks } from '../server/services/practice-pack.js';
import { matcherGrade, combineOverall, MATCHER_RULES } from '../server/services/practice-matcher.js';
import { graderInputFor } from './acceptance/practice-helpers.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS = path.join(ROOT, 'packs');
const PACK = path.join(PACKS, 'applied-ai');
const DRAFTS = path.join(ROOT, 'docs', 'research', 'applied-ai', 'module-1');
const DRAFTS2 = path.join(ROOT, 'docs', 'research', 'applied-ai', 'module-2');
const THREAD = path.join(ROOT, 'docs', 'team', 'threads', '0007-applied-ai-aws-track.md');
const readJson = f => JSON.parse(readFileSync(f, 'utf8'));
const TYPES = ['learn', 'catch', 'scenario', 'interview'];

// The pack in the validator's input shape; a fresh copy on each call.
function readPack() {
  const exercises = new Map();
  for (const f of readdirSync(path.join(PACK, 'exercises')).filter(f => f.endsWith('.json')).sort()) {
    exercises.set(f.slice(0, -5), readJson(path.join(PACK, 'exercises', f)));
  }
  const references = new Map();
  for (const f of readdirSync(path.join(PACK, 'reference')).filter(f => f.endsWith('.md')).sort()) {
    references.set(f.slice(0, -3), readFileSync(path.join(PACK, 'reference', f), 'utf8'));
  }
  return {
    manifest: readJson(path.join(PACK, 'practice.json')),
    schedule: readJson(path.join(PACK, 'schedule.json')),
    exercises, references
  };
}

// A module's draft exercises (a leading-underscore file is not an exercise and is not copied).
function readDrafts(root = DRAFTS) {
  const dir = path.join(root, 'exercises');
  return new Map(readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).sort()
    .map(f => [f.slice(0, -5), readJson(path.join(dir, f))]));
}

const moduleOf = (p, id) => p.manifest.modules.find(m => m.id === id);
const exercisesOf = (p, id) => moduleOf(p, id).exercises.map(x => p.exercises.get(x));
const DRAFTS_BY_MODULE = { m1: DRAFTS, m2: DRAFTS2 };

// F1c-T20, spec PD-15: module 2's exercises in the PM's order.
const M2_ORDER = [
  'm2-learn-01-agent-loop', 'm2-catch-01-tool-calling', 'm2-catch-02-agent-loop-clean', 'm2-learn-02-agent-guardrails',
  'm2-catch-03-workflow-or-agent', 'm2-catch-04-memory-state', 'm2-catch-05-guardrails', 'm2-learn-03-embedding-migration',
  'm2-catch-06-embeddings-ops-clean', 'm2-catch-07-production-failures', 'm2-catch-08-agent-eval-multiagent',
  'm2-catch-09-retrieval-eval', 'm2-scenario-01-delivery-support-agent', 'm2-interview-01-evaluate-agent',
  'm2-interview-02-workflow-or-agent', 'm2-interview-03-embedding-model-change', 'm2-interview-04-defend-agents'
];

test('applied-ai validates', () => {
  const p = readPack();
  assert.deepEqual(validatePracticePack(p), []);
  assert.equal(p.manifest.id, 'applied-ai');
  assert.equal(p.manifest.version, 3, 'bumped once for revision 6: the loader refuses changed content under a stored version');
  assert.deepEqual(p.manifest.modules.map(m => m.id), ['m1', 'm2']);
  assert.deepEqual([...moduleOf(p, 'm1').exercises].sort(), [...readDrafts().keys()], 'every m1 draft exercise, nothing else');
  assert.equal(moduleOf(p, 'm2').title, 'Agents and embeddings in depth');
  assert.deepEqual(moduleOf(p, 'm2').exercises, M2_ORDER);
  assert.deepEqual([...M2_ORDER].sort(), [...readDrafts(DRAFTS2).keys()], 'every m2 draft exercise, nothing else');
  assert.ok(p.manifest.provenance.builtBy.endsWith(
    '; F1c-T20: format-only copy of docs/research/applied-ai/module-2 (REVIEW.md; thread 0007 PD-15, PD-16)'));
});

test('each type present', () => {
  const p = readPack();
  for (const mod of ['m1', 'm2']) {
    const types = new Set(exercisesOf(p, mod).map(ex => ex.type));
    for (const t of TYPES) assert.ok(types.has(t), `module ${mod} has a ${t} exercise`);
  }
});

test('zero-planted present', () => {
  const p = readPack();
  const zero = mod => exercisesOf(p, mod).filter(ex => ex.type === 'catch' && ex.answerKey.planted.length === 0).map(ex => ex.id);
  assert.ok(zero('m1').length >= 1, 'module m1 has a catch with no planted statement');
  assert.deepEqual(zero('m2'), ['m2-catch-02-agent-loop-clean', 'm2-catch-06-embeddings-ops-clean']);
});

// The PM DECISION of 2026-10-15 in thread 0007 (append-only) holds the revision-6 block to copy
// exactly (PD-16, FR-064). It supersedes the 2026-10-14 block (PD-11), which stays in the thread.
function threadSchedule() {
  const text = readFileSync(THREAD, 'utf8');
  const marker = 'revision 6 schedule: copy this block exactly into `packs/applied-ai/schedule.json`';
  const at = text.indexOf(marker);
  assert.ok(at > 0, 'thread 0007 has the revision-6 PM schedule block');
  assert.equal(text.indexOf(marker, at + 1), -1, 'exactly one revision-6 block');
  const entry = text.lastIndexOf('### ', at);
  assert.match(text.slice(entry, text.indexOf('\n', entry)), /^### technical-product-manager · 2026-10-15 · DECISION$/);
  const m = /```json\n([\s\S]*?)\n```/.exec(text.slice(at));
  assert.ok(m, 'a json block follows the marker');
  return JSON.parse(m[1]);
}

test('schedule defaults', () => {
  const { schedule } = readPack();
  assert.deepEqual(schedule, threadSchedule());
  assert.equal(schedule.days, 7);
  assert.equal(schedule.minutesPerDay, 120);
  const blocks = schedule.plan.flatMap(d => d.blocks);
  const total = blocks.reduce((s, b) => s + b.minutes, 0);
  const practice = blocks.filter(b => ['catch', 'scenario', 'interview', 'review'].includes(b.kind))
    .reduce((s, b) => s + b.minutes, 0);
  assert.deepEqual([practice, total], [750, 840]);
  assert.ok(practice / total >= 0.6);
  assert.ok(schedule.diagnostic.length >= 1 && schedule.diagnostic.length <= 6);
  assert.deepEqual(schedule.diagnostic, [
    'm1-catch-01-context-window', 'm1-catch-02-rag-vs-finetune', 'm1-catch-03-pipeline-clean',
    'm1-catch-04-embeddings', 'm1-catch-05-structured-outputs', 'm1-interview-04-evaluate-rag'
  ]);
});

test('verified mapping keeps the original string in note', () => {
  const p = readPack();
  let unverified = 0;
  let m2Unverified = 0;
  for (const [id, draft] of [...readDrafts(), ...readDrafts(DRAFTS2)]) {
    const sources = p.exercises.get(id).sources;
    assert.equal(sources.length, draft.sources.length, id);
    draft.sources.forEach((s, i) => {
      const at = `${id} sources[${i}]`;
      assert.equal(typeof s.verified, 'string', `${at}: the draft value is a string`);
      assert.equal(sources[i].verified, s.verified.startsWith('fetched-'), at);
      assert.equal(sources[i].note, s.verified, at);
      assert.equal(sources[i].title, s.title, at);
      assert.equal(sources[i].url, s.url, at);
      if (!sources[i].verified) unverified++;
      if (s.verified === 'UNVERIFIED') {
        assert.equal(sources[i].verified, false, `${at}: UNVERIFIED stays false`);
        if (id.startsWith('m2-')) m2Unverified++;
      }
    });
  }
  assert.ok(unverified > 0, 'some sources are not fetched, so the false branch is exercised');
  assert.ok(m2Unverified > 0, 'module 2 has UNVERIFIED sources, and each stays false');
});

test('planted/clean partitions equal the drafts', () => {
  const p = readPack();
  const catches = [...readDrafts()].filter(([, d]) => d.type === 'catch');
  assert.equal(catches.length, 8);
  const catches2 = [...readDrafts(DRAFTS2)].filter(([, d]) => d.type === 'catch');
  assert.equal(catches2.length, 9);
  for (const [id, draft] of [...catches, ...catches2]) {
    const ex = p.exercises.get(id);
    assert.deepEqual(ex.narration, draft.narration, `${id} narration`);
    assert.deepEqual(ex.answerKey.planted.map(x => x.statementId), draft.answerKey.planted.map(x => x.statementId), `${id} planted`);
    assert.deepEqual(ex.answerKey.clean, draft.answerKey.clean, `${id} clean`);
  }
});

// C12 mapping, applied to a draft: what the pack file must hold, before the PD-1 additions.
const slug = name => {
  const s = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (s.length <= 60) return s;
  // The id rule is ^[a-z0-9-]{1,60}$, so a longer slug is cut at the last word boundary that fits.
  return s.slice(0, 61).replace(/-[^-]*$/, '').replace(/-+$/, '');
};
function mapDraft(d) {
  const ex = structuredClone(d);
  ex.sources = d.sources.map(s => ({ title: s.title, url: s.url, verified: s.verified.startsWith('fetched-'), note: s.verified }));
  if (d.challenges) ex.challenges = d.challenges.map(c => ({ question: c.challenge, rubric: c.expected }));
  if (d.acceptableArchitectures) {
    ex.acceptableArchitectures = d.acceptableArchitectures.map(({ name, ...rest }) => ({ id: slug(name), ...rest }));
  }
  return ex;
}
const PD1 = {
  'm1-catch-06-retrieval-vs-generation': ['both stages can contribute', 'right chunk ranked low|buried mid-context', 'fix ranking and prompt evidence order'],
  'm1-catch-08-design-tradeoffs': ['measure recall@k|hit rate', 'measure answer quality|faithfulness', 'latency and cost per query']
};

// Variant B2, the founder DECISION of 2026-10-15 in thread 0007: the learning-designer's lexicon
// proposal (rev2) without its suspectFixes, and with faithful.loyal dropped (its recommendedRemoval).
// The edits are read from the proposal file and applied here, so a drift on either side fails.
const PROPOSAL = readJson(path.join(DRAFTS, 'lexicon-proposal.json'));
const B2_SUSPECT = (() => {
  const rubric = [];
  const lexicon = [];
  for (const { fix } of PROPOSAL.suspectFixes.rows) {
    const r = /^(catch-\d{2}) (s\d+) (explain|correct)\[(\d+)\] alt '([^']+)'$/.exec(fix);
    if (r) { rubric.push({ prefix: `m1-${r[1]}-`, sid: r[2], dim: r[3], index: Number(r[4]), alt: r[5] }); continue; }
    const l = /^lexicon '([^']+)': \[(.+)\]$/.exec(fix);
    assert.ok(l, `suspect fix is in a known shape: ${fix}`);
    lexicon.push({ key: l[1], forms: [...l[2].matchAll(/'([^']+)'/g)].map(x => x[1]) });
  }
  return { rubric, lexicon };
})();

function applyB2Rubrics(id, ex) {
  const edits = PROPOSAL.rubricEdits[id] ?? {};
  for (const [sid, dims] of Object.entries(edits)) {
    const planted = ex.answerKey.planted.find(x => x.statementId === sid);
    assert.ok(planted, `${id} ${sid} is planted`);
    for (const dim of ['explain', 'correct']) {
      if (!dims[dim]) continue;
      planted.rubric[dim] = dims[dim].map((item, index) => {
        const drop = B2_SUSPECT.rubric.filter(x => id.startsWith(x.prefix) && x.sid === sid && x.dim === dim && x.index === index).map(x => x.alt);
        const alts = item.split('|');
        for (const d of drop) assert.ok(alts.includes(d), `${id} ${sid} ${dim}[${index}] has the suspect alternative ${d}`);
        return alts.filter(a => !drop.includes(a)).join('|');
      });
    }
  }
  return ex;
}

function applyB2Lexicon(synonyms) {
  const out = structuredClone(synonyms);
  for (const [raw, { forms }] of Object.entries(PROPOSAL.lexiconSynonyms_mergeIntoPracticeJson)) {
    if (raw.startsWith('_')) continue;
    const key = raw.replace(/ \(extend\)$/, '');
    const extend = key !== raw;
    const suspect = B2_SUSPECT.lexicon.filter(x => x.key === key).flatMap(x => x.forms);
    for (const f of suspect) assert.ok(forms.includes(f), `lexicon ${key} has the suspect form ${f}`);
    const kept = forms.filter(f => !suspect.includes(f));
    if (extend) {
      assert.ok(out[key], `${key} exists to extend`);
      for (const f of kept) if (!out[key].includes(f)) out[key].push(f);
    } else {
      assert.ok(!out[key], `${key} is a new key`);
      if (kept.length) out[key] = kept;
    }
  }
  for (const [key, form] of Object.keys(PROPOSAL.recommendedRemoval).map(k => k.split('.'))) {
    assert.ok(out[key]?.includes(form), `${key}: ${form} is there to remove`);
    out[key] = out[key].filter(f => f !== form);
  }
  return out;
}

test('B2 drops every suspect fix the proposal lists, and nothing else', () => {
  assert.equal(PROPOSAL.suspectFixes.rows.length, B2_SUSPECT.rubric.length + B2_SUSPECT.lexicon.length);
  assert.ok(B2_SUSPECT.rubric.length > 0 && B2_SUSPECT.lexicon.length > 0, 'both kinds are exercised');
  const p = readPack();
  const syn = p.manifest.lexicon.synonyms;
  for (const { key, forms } of B2_SUSPECT.lexicon) for (const f of forms) assert.ok(!(syn[key] ?? []).includes(f), `lexicon ${key} lacks ${f}`);
  for (const x of B2_SUSPECT.rubric) {
    const [, ex] = [...p.exercises].find(([id]) => id.startsWith(x.prefix));
    const items = ex.answerKey.planted.find(q => q.statementId === x.sid).rubric[x.dim];
    assert.ok(!items[x.index].split('|').includes(x.alt), `${x.prefix} ${x.sid} ${x.dim}[${x.index}] lacks a suspect alternative`);
  }
});

// F1c-T19, spec PD-14 (the PM's exact strings in tasks.md F1c-T19): echo-safe reveal wordings.
// Each replaces one acceptableCorrections entry; applied after the B2 edits.
const REV6_REVEAL = Object.freeze([
  { exercise: 'm1-catch-01-context-window', statementId: 's2', index: 1,
    text: "One request can hold more text in a bigger window, but the model's knowledge stays the same." },
  { exercise: 'm1-catch-04-embeddings', statementId: 's6', index: 0,
    text: 'For the migration, we build a fresh index by re-encoding the whole corpus with the replacement encoder, and queries move over once it is complete.' },
  { exercise: 'm1-catch-04-embeddings', statementId: 's6', index: 1,
    text: 'Each index is built with a single encoder, and a migration rebuilds it from scratch.' },
  { exercise: 'm1-catch-05-structured-outputs', statementId: 's5', index: 0,
    text: 'The lowest randomness setting makes outputs more consistent, but repeated runs of the same request can still differ.' }
].map(Object.freeze));

function applyRev6Reveal(id, ex, draft) {
  for (const e of REV6_REVEAL.filter(x => x.exercise === id)) {
    const at = `${id} ${e.statementId} acceptableCorrections[${e.index}]`;
    const before = draft.answerKey.planted.find(x => x.statementId === e.statementId).acceptableCorrections[e.index];
    assert.equal(typeof before, 'string', `${at} exists in the draft`);
    assert.notEqual(before, e.text, `${at} differs from its draft`);
    ex.answerKey.planted.find(x => x.statementId === e.statementId).acceptableCorrections[e.index] = e.text;
  }
  return ex;
}

test('each exercise is its draft under the C12 mapping plus the PD-1 follow-up rubrics, the B2 rubric edits and the revision-6 reveal edits', () => {
  const p = readPack();
  const drafts = readDrafts();
  for (const e of REV6_REVEAL) assert.ok(drafts.has(e.exercise), `${e.exercise} is a module-1 draft`);
  for (const [id, draft] of drafts) {
    const want = applyRev6Reveal(id, applyB2Rubrics(id, mapDraft(draft)), draft);
    if (PD1[id]) want.followUp = { question: draft.followUp, rubric: PD1[id] };
    assert.deepEqual(p.exercises.get(id), want, id);
  }
  // Module 2: the mapping only, no overlay (PD-15).
  for (const [id, draft] of readDrafts(DRAFTS2)) assert.deepEqual(p.exercises.get(id), mapDraft(draft), id);
  for (const sc of ['m1-scenario-01-policy-assistant', 'm2-scenario-01-delivery-support-agent']) {
    const ids = p.exercises.get(sc).acceptableArchitectures.map(a => a.id);
    assert.ok(ids.every(a => /^[a-z0-9-]{1,60}$/.test(a)) && new Set(ids).size === ids.length, `${sc}: architecture ids valid and unique`);
  }
});

test('reference files are the drafts renamed to <referenceId>.md, byte for byte', () => {
  const p = readPack();
  const drafts = Object.values(DRAFTS_BY_MODULE).flatMap(root => {
    const dir = path.join(root, 'reference');
    return readdirSync(dir).filter(f => f.endsWith('.md')).sort().map(f => path.join(dir, f));
  });
  const refId = f => /^(m[12]-ref-\d+)-/.exec(path.basename(f))[1];
  assert.equal(drafts.filter(f => refId(f).startsWith('m2-')).length, 11);
  assert.deepEqual([...p.references.keys()], drafts.map(refId));
  for (const f of drafts) assert.equal(p.references.get(refId(f)), readFileSync(f, 'utf8'), f);
});

test('revision-6 reveal edits hold no negator', () => {
  const tokens = t => t.toLowerCase().replace(/[’'`]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
  for (const e of REV6_REVEAL) {
    const hit = tokens(e.text).filter(w => MATCHER_RULES.negators.includes(w));
    assert.deepEqual(hit, [], `${e.exercise} ${e.statementId} acceptableCorrections[${e.index}]`);
  }
});

// FR-062 / SC-015: the modules the echo probe walks, with their planted-statement counts.
// F1c-T20 extends the probe to module 2 by changing only this set.
const ECHO_MODULES = Object.freeze({ m1: 13, m2: 17 });
const ECHO_REWORDED = new Set(['m1-catch-01-context-window s2', 'm1-catch-04-embeddings s6', 'm1-catch-05-structured-outputs s5']);

test("FR-062 echo probe: no planted statement's own narration text earns correction or overall met; the three reworded stops are uncertain", t => {
  const p = readPack();
  const lexicon = p.manifest.lexicon;
  const bad = [];
  const seen = new Set();
  for (const [mod, count] of Object.entries(ECHO_MODULES)) {
    const ids = p.manifest.modules.find(m => m.id === mod).exercises;
    let n = 0;
    for (const ex of ids.map(id => p.exercises.get(id)).filter(ex => ex.type === 'catch')) {
      for (const { statementId } of ex.answerKey.planted) {
        n++;
        const flawed = ex.narration.find(x => x.id === statementId).text;
        const { input, dims } = graderInputFor(ex, `stop:${statementId}`, flawed, lexicon);
        const out = matcherGrade(input);
        const [explanation, correction] = dims.map(d => out.dimensions[d].status);
        const overall = combineOverall(dims.map(d => out.dimensions[d]));
        const key = `${ex.id} ${statementId}`;
        t.diagnostic(`${key} ${explanation} ${correction} ${overall}`);
        if (correction === 'met' || overall === 'met') bad.push(`${key}: met`);
        if (ECHO_REWORDED.has(key)) { seen.add(key); if (overall !== 'uncertain') bad.push(`${key}: ${overall}, not uncertain`); }
      }
    }
    assert.equal(n, count, `${mod} planted statements walked`);
  }
  assert.deepEqual(bad, []);
  assert.equal(seen.size, ECHO_REWORDED.size, 'every reworded stop was walked');
});

// Forms dropped because, after FR-017 normalization and word-start stemming, they match words the
// form doesn't name: a stopword is silently removed ("itself", "to"), or the stem is a different
// common word ("fixed" stems to "fix", so any "fix" would count as "unchanged").
const DROPPED = { weights: ['model itself'], unchanged: ['fixed'], faithful: ['stuck to'] };

test('lexicon is the draft synonym list minus the FR-017-failing forms, plus the B2 lexicon edits', () => {
  const draft = readJson(path.join(DRAFTS, 'exercises', '_matcher-test-answers.json')).proposedLexicon.synonyms;
  const want = Object.fromEntries(Object.entries(draft).map(([k, forms]) => [k, forms.filter(f => !(DROPPED[k] ?? []).includes(f))]));
  for (const [k, forms] of Object.entries(DROPPED)) for (const f of forms) assert.ok(draft[k].includes(f), `${k}: ${f} is a draft form`);
  assert.deepEqual(readPack().manifest.lexicon.synonyms, applyB2Lexicon(want));
});

test('loader stores applied-ai@3 once', t => {
  const dir = mkdtempSync(path.join(tmpdir(), 'f1c-t11-'));
  const file = path.join(dir, 'app.db');
  const warn = console.warn;
  const warnings = [];
  console.warn = (...a) => warnings.push(a.join(' '));
  t.after(() => { console.warn = warn; rmSync(dir, { recursive: true, force: true }); });

  const db = openDb(file);
  for (let i = 0; i < 2; i++) {
    const tracks = loadPracticePacks(PACKS, db, { getPack: () => null });
    assert.ok(tracks.has('applied-ai'), `load ${i + 1}`);
  }
  db.close();
  console.warn = warn;
  assert.deepEqual(warnings.filter(w => w.startsWith('[practice]')), []);
  assert.deepEqual(listTracks().find(x => x.id === 'applied-ai'), { id: 'applied-ai', title: 'Applied AI', version: 3 });
  const ro = new DatabaseSync(file, { readOnly: true });
  t.after(() => ro.close());
  const rows = ro.prepare("SELECT id, version FROM subject_pack WHERE id = 'applied-ai'").all().map(r => ({ ...r }));
  assert.deepEqual(rows, [{ id: 'applied-ai', version: 3 }]);
});

test('listSubjects() is unchanged by packs/applied-ai (C3)', () => {
  loadPacks(PACKS, openDb(':memory:'));
  assert.deepEqual(listSubjects().map(s => s.id), ['demo-trades']);
});
