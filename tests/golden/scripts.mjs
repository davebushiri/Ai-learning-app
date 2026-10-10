// Golden matrix: fixtures, play scripts and run ids (F1a-T03a).
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

// The T03a matrix: 48 MOCK runs plus the 4 allow-listed failure runs.
// T03b adds the 9 live-fake rows.
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
  return runs.map(r => ({ ...r, label: FIXTURES[r.fixture].label, stops: SCRIPTS[r.script](FIXTURES[r.fixture]) }));
}
