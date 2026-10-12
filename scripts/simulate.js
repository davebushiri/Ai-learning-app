// Scoring simulator — Ringmaster's tuning tool.
// Plays every fixture with a set of scripted "players" and prints what each
// one would score, so you can tune RULES in shared/scoring.js and see the effect.
//
//   npm run simulate

import { readdirSync, readFileSync } from 'node:fs';
import { resolveStop, scoreStop, scoreRun } from '../shared/scoring.js';

// A player decides, for each step index, whether to hit STOP and how good
// their explanation is. Return null to keep watching, or { verdict, reasoningScore }.
export const PLAYERS = {
  'perfect':          (s, i) => (s.steps[i].error ? good() : null),
  'late by one':      (s, i) => (s.steps[i - 1]?.error ? good() : null),
  'vague but right':  (s, i) => (s.steps[i].error ? { verdict: 'partial', reasoningScore: 0.4 } : null),
  'critical only':    (s, i) => (s.steps[i].error?.severity === 'critical' ? good() : null),
  'misses critical':  (s, i) => (s.steps[i].error && s.steps[i].error.severity !== 'critical' ? good() : null),
  'nervous (+2 FA)':  (s, i) => (s.steps[i].error || i === 0 || i === s.steps.length - 1 ? good() : null),
  'spams STOP, smart': () => good(),
  'spams STOP, blind': () => ({ verdict: 'wrong', reasoningScore: 0 }),
  'never stops':      () => null
};

function good() {
  return { verdict: 'correct', reasoningScore: 1 };
}

// Mirrors the event recording in web/app.js submitExplanation().
export function playRun(scenario, player) {
  const events = [];
  const caught = new Set();
  scenario.steps.forEach((step, i) => {
    const answer = player(scenario, i);
    if (!answer) return;
    const target = resolveStop(scenario, i, caught);
    const verdict = target ? answer.verdict : 'false_alarm';
    const severity = target ? scenario.steps.find(s => s.id === target.errorStepId).error.severity : null;
    const points = scoreStop({ severity, stepsLate: target?.stepsLate ?? 0, verdict, reasoningScore: answer.reasoningScore });
    if (target) {
      caught.add(target.errorStepId);
      events.push({ type: 'catch', stepId: step.id, errorStepId: target.errorStepId, stepsLate: target.stepsLate, verdict, points });
    } else {
      events.push({ type: 'false_alarm', stepId: step.id, points });
    }
  });
  return scoreRun(scenario, events);
}

// Every pack's scenario files, in pack-id order and then ascending fixture file-name order
// (thread 0005), so adding a pack needs no change here.
function packFixtures() {
  const root = new URL('../packs/', import.meta.url);
  const out = [];
  for (const d of readdirSync(root, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name).sort()) {
    const dir = new URL(`${d}/`, root);
    let pack;
    try {
      pack = JSON.parse(readFileSync(new URL('pack.json', dir)));
    } catch {
      continue; // not a pack
    }
    const files = [...new Set((pack.scenarios ?? []).map(s => s.fixture))].sort();
    for (const file of files) out.push({ file, url: new URL(`scenarios/${file}`, dir) });
  }
  return out;
}

function main() {
  for (const { file, url } of packFixtures()) {
    const scenario = JSON.parse(readFileSync(url));
    console.log(`\n${scenario.title}  (${file})`);
    const rows = Object.entries(PLAYERS).map(([name, player]) => {
      const r = playRun(scenario, player);
      return { player: name, score: `${r.total} / ${r.maxPossible}`, caught: `${r.caughtCount}/${r.mistakeCount}`, 'false alarms': r.falseAlarms, rating: r.rating };
    });
    console.table(rows);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main();
