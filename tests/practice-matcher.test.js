// F1c-T03: the rubric-concept matcher (FR-013, FR-014, FR-017–FR-022, FR-043; C1, PD-2, PD-3).
// The vocabulary here is a neutral fictional subject (lanterns, kettles, harbors).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MATCHER_VERSION, MATCHER_RULES, matcherGrade, matchClarification, combineOverall
} from '../server/services/practice-matcher.js';

const NO_LEX = { synonyms: {} };
// Grade one dimension ("explanation") and return its result.
const dim = (items, answer, extra = {}) => matcherGrade({
  answer,
  dimensions: { explanation: { items, ...(extra.alternatives ? { alternatives: extra.alternatives } : {}) } },
  lexicon: extra.lexicon ?? NO_LEX,
  ...(extra.flawedText ? { flawedText: extra.flawedText } : {}),
  ...(extra.redFlags ? { redFlags: extra.redFlags } : {})
}).dimensions.explanation;

test('version and rules are exported and frozen', () => {
  assert.equal(MATCHER_VERSION, 'matcher@1');
  assert.ok(Object.isFrozen(MATCHER_RULES));
  assert.equal(MATCHER_RULES.negationWindow, 3);
  assert.deepEqual(MATCHER_RULES.negators.slice(0, 3), ['not', 'no', 'never']);
  const out = matcherGrade({ answer: 'kettle lantern orbit harbor', dimensions: { explanation: { items: ['kettle'] } }, lexicon: NO_LEX });
  assert.equal(out.graderSource, 'matcher');
  assert.equal(out.graderVersion, 'matcher@1');
});

test('item match needs ceil(0.6n) tokens; n ≤ 2 needs all', () => {
  const five = 'alpha beta gamma delta epsilon';
  assert.equal(dim([five], 'alpha beta gamma plus harbor lantern words').status, 'met');
  assert.equal(dim([five], 'alpha beta plus harbor lantern words').status, 'not_met');
  assert.equal(dim(['alpha beta'], 'alpha only, with harbor lantern words').status, 'not_met');
  assert.equal(dim(['alpha beta'], 'beta and alpha, with harbor lantern words').status, 'met');
});

test('an item matches through any | alternative; matched reports the whole item (C1)', () => {
  const d = dim(['kettle boils|steam rises', 'harbor beacon'], 'the steam rises over the lantern wall');
  assert.deepEqual(d.matched, ['kettle boils|steam rises']);
  assert.deepEqual(d.missing, ['harbor beacon']);
});

test('word-start match with stemming (tested hits test; online does not hit line)', () => {
  assert.equal(dim(['tested'], 'we test the lantern rigging every single morning').status, 'met');
  assert.equal(dim(['test'], 'we tested the lantern rigging every single morning').status, 'met');
  assert.equal(dim(['line'], 'went online yesterday quickly').status, 'not_met');
  assert.equal(dim(['run'], 'they ran outside, the runs ended today').status, 'met');
});

test('lexicon synonym satisfies a token', () => {
  const lexicon = { synonyms: { glows: ['shines brightly', 'gleams'] } };
  assert.equal(dim(['lantern glows'], 'the lantern shines brightly tonight over the calm bay', { lexicon }).status, 'met');
  assert.equal(dim(['lantern glows'], 'the lantern gleamed over the calm dark bay', { lexicon }).status, 'met');
  assert.equal(dim(['lantern glows'], 'the lantern shines over the calm dark bay').status, 'not_met');
});

test('met / partial / not_met thresholds', () => {
  const items = ['kettle boils', 'harbor beacon', 'orbit slows'];
  assert.equal(dim(items, 'the kettle boils in the morning kitchen').status, 'partial');
  assert.equal(dim(items, 'something else entirely about weather').status, 'not_met');
  assert.equal(dim(items, 'kettle boils, harbor beacon lit, orbit slows down later this busy season').status, 'met');
});

test('met threshold is ceil(n × 2/3 − 1e-9): 2 of 3 met, 2 of 2 met, 1 of 2 partial, 3 of 4 met, 2 of 4 partial (PD-3)', () => {
  const tail = ' while the crew rests quietly';
  assert.equal(dim(['kettle', 'harbor', 'orbit'], 'kettle harbor' + tail).status, 'met');
  assert.equal(dim(['kettle', 'harbor'], 'kettle harbor' + tail).status, 'met');
  assert.equal(dim(['kettle', 'harbor'], 'kettle' + tail).status, 'partial');
  assert.equal(dim(['kettle', 'harbor', 'orbit', 'beacon'], 'kettle harbor orbit' + tail).status, 'met');
  assert.equal(dim(['kettle', 'harbor', 'orbit', 'beacon'], 'kettle harbor' + tail).status, 'partial');
});

test('fewer than 3 content words is not_met', () => {
  assert.equal(dim(['kettle boils'], 'kettle boils').status, 'not_met');
  assert.equal(dim(['kettle boils'], 'the kettle, it boils').status, 'not_met');
});

test('stuffed answer capped at partial', () => {
  assert.equal(dim(['kettle', 'lantern', 'orbit'], 'kettle lantern orbit').status, 'partial');
  assert.equal(dim(['kettle', 'lantern', 'orbit'], 'kettle lantern orbit harbor beacon').status, 'partial');
  assert.equal(dim(['kettle', 'lantern', 'orbit'], 'kettle lantern orbit harbor beacon tide').status, 'met');
});

test('valid alternative correction met when rubric.correct not', () => {
  const d = dim(['harbor beacon swings'], 'refill the lantern before dusk every evening so sailors can see the rocks', {
    alternatives: ['The lantern must be refilled before dusk.']
  });
  assert.equal(d.status, 'met');
  assert.ok(d.matched.includes('The lantern must be refilled before dusk.'));
  assert.deepEqual(d.missing, ['harbor beacon swings']);
});

test('best architecture wins; no mustInclude means design equals mustCover', () => {
  const answer = 'kettle and lantern first, then a harbor beacon on the long stone pier at night';
  const withArch = matcherGrade({
    answer, lexicon: NO_LEX,
    dimensions: { explanation: { items: ['kettle', 'lantern'], architectures: [
      { id: 'a1', mustInclude: ['orbit', 'tide gauge'] },
      { id: 'a2', mustInclude: ['harbor', 'beacon'] }] } }
  });
  assert.equal(withArch.architectureId, 'a2');
  assert.equal(withArch.dimensions.explanation.status, 'met');
  // The lower of mustCover and the best architecture wins.
  const weak = matcherGrade({
    answer, lexicon: NO_LEX,
    dimensions: { explanation: { items: ['kettle', 'lantern'], architectures: [{ id: 'a1', mustInclude: ['orbit', 'tide', 'gauge'] }] } }
  });
  assert.equal(weak.dimensions.explanation.status, 'not_met');
  assert.equal(weak.architectureId, null);
  const none = matcherGrade({
    answer, lexicon: NO_LEX,
    dimensions: { explanation: { items: ['kettle', 'lantern', 'orbit'], architectures: [{ id: 'a1' }, { id: 'a2', mustInclude: [] }] } }
  });
  assert.equal(none.dimensions.explanation.status, dim(['kettle', 'lantern', 'orbit'], answer).status);
  assert.equal(none.dimensions.explanation.status, 'met');
  assert.equal(none.architectureId, null);
});

test('long unmatched answer is uncertain', () => {
  const long = 'the crew walked along the quiet pier while gulls circled above the old warehouses, '
    + 'talking about weather, supper, music, boats, ropes, paint, maps, sails, clouds and distant islands and gentle songs';
  const d = dim(['kettle boils', 'orbit slows'], long);
  assert.equal(d.status, 'uncertain');
  assert.equal(d.confidence, 'low');
  assert.equal(dim(['kettle boils'], 'the crew walked along the quiet pier').status, 'not_met');
  assert.equal(dim(['kettle boils'], 'the crew walked along the quiet pier').confidence, 'high');
});

test('negation before a matched token is uncertain', () => {
  const d = dim(['lantern glows'], 'the lantern never glows during the storm season');
  assert.equal(d.status, 'uncertain');
  assert.equal(d.confidence, 'low');
  // Outside the 3-token window the negator does not apply.
  assert.equal(dim(['lantern glows'], 'never mind harbor ropes masts, the lantern glows').status, 'met');
});

test('the negation window counts every word, stopwords included', () => {
  // "not" is 4 words before "harbor" (3 content tokens before it): outside the window.
  assert.equal(dim(['harbor beacon'], 'the crew did not see the old harbor beacon lit tonight').status, 'met');
  assert.equal(dim(['harbor beacon'], 'the crew did not see harbor beacon lit tonight').status, 'uncertain');
});

test('the negation window stops at a sentence or clause break', () => {
  assert.equal(dim(['lantern glows'], 'Not quite. The lantern glows bright over the calm bay').status, 'met');
  assert.equal(dim(['lantern glows'], 'Not quite the lantern glows bright over the calm bay').status, 'uncertain');
});

test('negation is skipped when the matched alternative itself contains a negator (PD-2)', () => {
  const d = dim(['not fully deterministic at zero'], 'temperature zero is still not fully deterministic');
  assert.deepEqual(d.matched, ['not fully deterministic at zero']);
  assert.notEqual(d.status, 'uncertain');
  assert.equal(d.confidence, 'high');
});

test("negators are content tokens: 'consistent and identical' does not match 'more consistent not identical' (PD-2)", () => {
  const d = dim(['more consistent not identical'], "That's fine. At zero the answers are consistent and identical every time.");
  assert.deepEqual(d.matched, []);
  assert.notEqual(d.status, 'met');
  assert.notEqual(d.status, 'partial');
});

test("apostrophes are removed: wouldn't is the negator wouldnt", () => {
  assert.equal(dim(['wouldnt polish lantern'], 'I wouldn’t polish the lantern with rough sand paper').status, 'met');
  assert.equal(dim(['polish lantern'], "I wouldn't polish the lantern with rough sand paper").status, 'uncertain');
});

test('echoing the flawed statement is uncertain', () => {
  const flawedText = 'The lantern burns seawater, so it never needs oil.';
  const d = dim(['oil fuels flame'], 'yes, the lantern burns seawater and never needs any oil', { flawedText });
  assert.equal(d.status, 'uncertain');
  // A correction that matches lifts the echo rule.
  const ok = matcherGrade({
    answer: 'the lantern burns seawater? wrong, it needs oil, because oil fuels the lantern', flawedText, lexicon: NO_LEX,
    dimensions: { correction: { items: ['oil fuels lantern'] } }
  });
  assert.notEqual(ok.dimensions.correction.status, 'uncertain');
});

test('red flag makes uncertain', () => {
  const out = matcherGrade({
    answer: 'we can skip the beacon check tonight, kettle boils anyway', lexicon: NO_LEX,
    dimensions: { explanation: { items: ['kettle boils'] } }, redFlags: ['skip beacon check']
  });
  assert.deepEqual(out.redFlagsMatched, ['skip beacon check']);
  assert.equal(out.dimensions.explanation.status, 'uncertain');
});

test('a negated red flag is not counted and not listed (PD-2)', () => {
  const out = matcherGrade({
    answer: "I wouldn't fine-tune for knowledge; I would retrieve it from the index", lexicon: NO_LEX,
    dimensions: { explanation: { items: ['retrieve index'] } }, redFlags: ['fine-tuning for knowledge']
  });
  assert.deepEqual(out.redFlagsMatched, []);
  assert.equal(out.dimensions.explanation.status, 'met');
});

test('strong signals are listed when matched', () => {
  const out = matcherGrade({
    answer: 'kettle boils first, then the harbor beacon is lit', lexicon: NO_LEX,
    dimensions: { explanation: { items: ['kettle boils'] } }, strongSignals: ['harbor beacon', 'orbit']
  });
  assert.deepEqual(out.strongSignalsMatched, ['harbor beacon']);
});

test('never throws on non-string input', () => {
  for (const input of [undefined, null, 42, 'x', [], { answer: 42 }, { answer: null, dimensions: null },
    { answer: 'kettle lantern orbit', dimensions: { explanation: { items: [null, 5, 'kettle', ''] } }, lexicon: { synonyms: { kettle: [null, 7, 'pot'] } } },
    { answer: ['a'], dimensions: { explanation: 'nope', correction: { items: 'kettle', alternatives: 9 } }, redFlags: 'x', lexicon: 5 },
    { answer: 'kettle a|b|c|d|e|f|g|h|i|j', dimensions: { explanation: { items: ['a|b|c|d|e|f|g|h|i|kettle'], architectures: [null, { id: 1, mustInclude: 'x' }] } } }]) {
    const out = matcherGrade(input);
    assert.equal(out.graderSource, 'matcher');
    assert.ok(Array.isArray(out.redFlagsMatched));
  }
  assert.equal(matchClarification(null, null, null), null);
  assert.equal(combineOverall(null), 'not_met');
});

test('only the first 8 | alternatives are used', () => {
  assert.equal(dim(['a1x|b2x|c3x|d4x|e5x|f6x|g7x|h8x|kettle'], 'kettle harbor beacon orbit').status, 'not_met');
  assert.equal(dim(['a1x|b2x|c3x|d4x|e5x|f6x|g7x|kettle'], 'kettle harbor beacon orbit').status, 'met');
});

test('matchClarification returns the first matching clarification index', () => {
  const clar = [{ askAbout: ['budget|cost'] }, { askAbout: ['harbor depth', 'tide'] }, { askAbout: ['tide'] }];
  assert.equal(matchClarification('what is the tide like?', clar, NO_LEX), 1);
  assert.equal(matchClarification('how much will it cost', clar, NO_LEX), 0);
  assert.equal(matchClarification('what colour is the door', clar, NO_LEX), null);
  assert.equal(matchClarification('how much money', clar, { synonyms: { budget: ['money'] } }), 0);
});

test('overall combination table', () => {
  const s = status => ({ status, matched: [], missing: [] });
  const rows = [
    [['met', 'met'], 'met'], [['not_met', 'not_met'], 'not_met'], [['met', 'not_met'], 'partial'],
    [['partial', 'met'], 'partial'], [['partial', 'not_met'], 'partial'], [['met', 'uncertain'], 'uncertain'],
    [['uncertain', 'not_met'], 'uncertain'], [['partial', 'partial'], 'partial']
  ];
  for (const [dims, want] of rows) assert.equal(combineOverall(dims.map(s)), want, dims.join('+'));
});

// Hand traces against the learning-designer's module-1 answers (extra sanity input; the formal
// labelled set is QA's T01a). Prints the table; asserts only the safety rules.
test('module-1 hand traces: incorrect answers never met; table printed', t => {
  const base = new URL('../docs/research/applied-ai/module-1/exercises/', import.meta.url);
  const A = JSON.parse(readFileSync(new URL('_matcher-test-answers.json', base), 'utf8'));
  const lexicon = { synonyms: A.proposedLexicon.synonyms };
  const rows = [];
  for (const it of A.items) {
    if (!it.statementId) continue;
    const ex = JSON.parse(readFileSync(new URL(`${it.exercise}.json`, base), 'utf8'));
    const p = ex.answerKey.planted.find(x => x.statementId === it.statementId);
    const flawedText = ex.narration.find(n => n.id === it.statementId).text;
    for (const a of it.answers) {
      const out = matcherGrade({
        answer: a.text, flawedText, lexicon, redFlags: p.redFlags,
        dimensions: { explanation: { items: p.rubric.explain }, correction: { items: p.rubric.correct, alternatives: p.acceptableCorrections } }
      });
      const e = out.dimensions.explanation.status, c = out.dimensions.correction.status;
      const overall = combineOverall([out.dimensions.explanation, out.dimensions.correction]);
      rows.push(`${it.exercise.slice(0, 11)} ${a.class.padEnd(17)} expl=${e.padEnd(9)} corr=${c.padEnd(9)} overall=${overall.padEnd(9)} expected=${a.expected.overall}`);
      if (a.class === 'incorrect') assert.notEqual(overall, 'met', `${it.exercise} incorrect graded met`);
    }
  }
  t.diagnostic('\n' + rows.join('\n'));
});
