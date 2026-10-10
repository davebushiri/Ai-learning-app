// Golden matrix: fixtures, play scripts and run ids (F1a-T03a, F1a-T03b).
//
// Everything a replay needs is inline here. Nothing is read from the product
// tree at replay (thread 0004 isolation ruling): the job labels, the line
// numbers of each planted mistake and every explanation are frozen below,
// copied by hand from the three demo jobs at capture time.
//
// Line numbers are 1-based, as the learner sees them ("line 3").
// A STOP happens when line N has just been appended (and, in voice mode, is
// still being spoken), never after a time delay.

export const FIXTURES = {
  electrical: {
    label: 'Electrical: replace a receptacle',
    critical: 3,
    major: 5,
    minor: 7,
    explain: {
      3: 'He never tested that the circuit was dead with a meter before touching the wires',
      5: 'Next to the sink it needs GFCI protection or someone could get a shock from the water',
      7: 'The wire has to wrap clockwise under the terminal screw or it works loose and heats up'
    }
  },
  hvac: {
    label: 'HVAC: braze a suction line',
    major: 3,
    critical: 5,
    minor: 7,
    explain: {
      3: 'He has to flow nitrogen through the pipe while brazing or it builds oxidation scale inside',
      5: 'Brazing next to that dry hedge with no fire extinguisher or heat shield could start a fire',
      7: 'Wrap the valve with a wet rag so the heat does not ruin the seals'
    }
  },
  automotive: {
    label: 'Automotive: front brake job',
    critical: 3,
    minor: 5,
    major: 7,
    explain: {
      3: 'Never work under a car held up only by the jack, put it on jack stands so it cannot fall and crush you',
      5: 'Do not let the caliper hang by the brake line, hook it up with a wire so the hose does not stretch',
      7: 'Use a torque wrench and the spec from the manual or the lug nuts can back out'
    }
  }
};

const WRONG = 'his shoes are untied';
const FALSE_ALARM = 'he should lock it out';
const SECOND_LOOK = 'that looks wrong too';

const mistakes = f => [f.critical, f.major, f.minor].sort((a, b) => a - b);
const stop = (line, say) => ({ line, say });

// Each script maps a fixture to its ordered STOPs: [{ line, say }].
export const SCRIPTS = {
  perfect: f => mistakes(f).map(n => stop(n, f.explain[n])),
  'late-by-one': f => mistakes(f).map(n => stop(n + 1, f.explain[n])),
  'false-alarm': () => [stop(1, FALSE_ALARM)],
  'missed-critical': f => [f.major, f.minor].sort((a, b) => a - b).map(n => stop(n, f.explain[n])),
  'never-stop': () => [],
  'empty-explanation': f => [stop(f.critical, '')],
  'wrong-explanation': f => [stop(f.critical, WRONG)],
  'double-stop': f => [stop(f.critical, f.explain[f.critical]), stop(f.critical + 1, SECOND_LOOK)],
  // Allow-listed failure runs: one correct STOP on the critical line (US2.1, US3.1).
  'grade-aborted': f => [stop(f.critical, f.explain[f.critical])],
  'complete-aborted': f => [stop(f.critical, f.explain[f.critical])]
};

const MOCK_SCRIPTS = ['perfect', 'late-by-one', 'false-alarm', 'missed-critical', 'never-stop', 'empty-explanation', 'wrong-explanation', 'double-stop'];
const SPEECH = ['voice', 'text'];

export const runId = (script, fixture, speech) => `${script}-${fixture}-${speech}`;

// ---------- live-fake rows (F1a-T03b) ----------
// The server runs in LIVE mode against tests/helpers/fake-claude.mjs. `card`
// is "cached" (the Use cached scenario box is ticked, so only grading calls
// Claude) or "generated" (the scenario is generated through fake Claude too).
// `fake` is the fake-Claude mode for the whole run ({} = happy path).
export const LIVE_ROWS = [
  ...Object.keys(FIXTURES).flatMap(fixture => ['perfect', 'false-alarm'].map(script =>
    ({ prefix: 'live', script, fixture, card: 'cached', fake: {} }))),
  { prefix: 'live-generated', script: 'perfect', fixture: 'electrical', card: 'generated', fake: {} },
  { prefix: 'live-hang', script: 'perfect', fixture: 'electrical', card: 'cached', fake: { hang: true } },
  { prefix: 'live-429', script: 'perfect', fixture: 'electrical', card: 'cached', fake: { status: 429, retryAfter: '60' } }
];

// ---------- masking lists for the live-generated run (review OI-10) ----------
// Frozen by hand at capture time (2026-10-10) from the electrical trade entry
// and the scenario prompt module; nothing is read from the product at replay.
// The scenario prompt draws one value per label at random; the harness masks
// the value and asserts it is a member of the list below.
const ELECTRICAL_CRITICAL_HINTS = [
  'verifying the circuit is dead before touching it',
  'shock protection near water',
  'grounding and the equipment ground',
  'a second circuit or shared neutral in the same box'
];
const ELECTRICAL_HAZARD_HINTS = 'lockout / verifying de-energized (live-dead-live), GFCI requirements near water, terminations, box fill, grounding';
const ELECTRICAL_TWISTS = [
  'the homeowner is cooking dinner and wants the kitchen back fast',
  'the panel directory is faded and half the labels are guesses',
  'the box is old metal with cloth-covered wiring',
  'a handyman did the last repair and it shows',
  'the countertop backsplash is tile and the box is set deep',
  'the homeowner keeps asking if the dishwasher will still work'
];
const DEFAULT_TWISTS = [
  'the homeowner is watching and chatty',
  'it is getting dark',
  'a part from the truck is the wrong size',
  'the previous work was done by a handyman'
];
const APPRENTICE_NAMES = ['Danny', 'Marcus', 'Jess', 'Priya', 'Luis', 'Tasha', 'Kenji', 'Ava', 'Rob', 'Mo'];

// label -> { list name, allowed values }, per the T03a "Normalization" rule:
// criticalHints, else hazardHints split on commas and trimmed, plus the literal
// fallback; twists, else DEFAULT_TWISTS; APPRENTICE_NAMES.
const or = (a, b) => (a.length ? a : b);
export const MASKS = {
  'Draw the critical mistake from: ': {
    list: 'criticalHints',
    values: [...or(ELECTRICAL_CRITICAL_HINTS, ELECTRICAL_HAZARD_HINTS.split(',').map(s => s.trim()).filter(Boolean)), 'any of the hazard areas']
  },
  'Jobsite twist to include: ': { list: 'twists', values: or(ELECTRICAL_TWISTS, DEFAULT_TWISTS) },
  'Apprentice name: ': { list: 'APPRENTICE_NAMES', values: APPRENTICE_NAMES }
};

// The full matrix: 48 MOCK runs, the 4 allow-listed failure runs (T03a) and
// the 9 live-fake runs (T03b) = 61.
export function matrix() {
  const runs = [];
  for (const fixture of Object.keys(FIXTURES)) {
    for (const script of MOCK_SCRIPTS) {
      for (const speech of SPEECH) runs.push({ runId: runId(script, fixture, speech), mode: 'mock', speech, fixture, script, abort: null });
    }
  }
  for (const abort of ['grade-aborted', 'complete-aborted']) {
    for (const speech of SPEECH) runs.push({ runId: runId(abort, 'electrical', speech), mode: 'mock', speech, fixture: 'electrical', script: abort, abort });
  }
  for (const { prefix, script, fixture, card, fake } of LIVE_ROWS) {
    runs.push({ runId: `${prefix}-${runId(script, fixture, 'text')}`, mode: 'live-fake', speech: 'text', fixture, script, abort: null, card, fake, mask: card === 'generated' });
  }
  return runs.map(r => ({ ...r, label: FIXTURES[r.fixture].label, stops: SCRIPTS[r.script](FIXTURES[r.fixture]) }));
}
