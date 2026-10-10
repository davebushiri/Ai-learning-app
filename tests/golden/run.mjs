// Golden replay CLI (F1a-T03a, F1a-T03b).
//
//   node tests/golden/run.mjs --capture [--only <runId>[,<runId>...]]
//   node tests/golden/run.mjs --replay [--repeat N] [--only <runId>[,<runId>...]] [--expect-aborts]
//
// Exit 0 = no diff outside allow-list.json, every abort check passed, every
// masked value of the live-generated run is a member of its list, no console
// errors and no run error. At replay this reads only tests/golden/**
// and tests/fixtures/golden/** (the server it spawns reads the product, of course).

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { matrix } from './scripts.mjs';
import { launchBrowser, playRun, LIVE_FAKE_ENV, SHOTS_DIR } from './harness.mjs';

const GOLDEN = fileURLToPath(new URL('../fixtures/golden/', import.meta.url));
const RUNS_DIR = path.join(GOLDEN, 'runs');
const MANIFEST = path.join(GOLDEN, 'manifest.json');
const ALLOW_LIST = path.join(GOLDEN, 'allow-list.json');
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const OUT_DIR = path.join(os.tmpdir(), 'golden-replay');

// ---------- args ----------
const argv = process.argv.slice(2);
const flag = name => argv.includes(name);
const value = name => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
const capture = flag('--capture');
const replay = flag('--replay');
const repeat = Number(value('--repeat') ?? 1);
const only = value('--only');
const expectAborts = flag('--expect-aborts');
if (capture === replay || !Number.isInteger(repeat) || repeat < 1) {
  console.error('usage: run.mjs --capture | --replay [--repeat N] [--only <runId>] [--expect-aborts]');
  process.exit(2);
}

// Byte-for-byte form of a run, without abortsFired (recorded at replay, never diffed).
const serialize = rec => JSON.stringify(rec, null, 2) + '\n';
const comparable = rec => {
  const { abortsFired, ...rest } = rec;
  return rest;
};

function diffRun(expected, actual) {
  const out = [];
  const keys = new Set([...Object.keys(comparable(expected)), ...Object.keys(comparable(actual))]);
  for (const k of keys) {
    const a = JSON.stringify(expected[k]);
    const b = JSON.stringify(actual[k]);
    if (a === b) continue;
    if (Array.isArray(expected[k]) && Array.isArray(actual[k])) {
      const n = Math.max(expected[k].length, actual[k].length);
      const i = [...Array(n).keys()].find(j => JSON.stringify(expected[k][j]) !== JSON.stringify(actual[k][j]));
      out.push(`${k}[${i}]: expected ${JSON.stringify(expected[k][i])} got ${JSON.stringify(actual[k][i])}`);
    } else {
      out.push(`${k}: expected ${a} got ${b}`);
    }
  }
  return out;
}

// Abort checks (thread 0004): a grade-aborted run that aborted nothing tests nothing.
function abortProblem(run, abortsFired) {
  if (run.script === 'grade-aborted' && abortsFired === 0) return 'grade-aborted run fired 0 aborts';
  if (expectAborts && run.script === 'complete-aborted' && abortsFired === 0) return 'complete-aborted run fired 0 aborts (--expect-aborts)';
  return null;
}

// Capture-time metadata only; never compared at replay.
function treeSha256() {
  const files = [];
  const walk = rel => {
    const abs = path.join(REPO, rel);
    if (!statSync(abs, { throwIfNoEntry: false })) return;
    if (statSync(abs).isDirectory()) {
      for (const name of readdirSync(abs)) walk(path.posix.join(rel, name));
    } else files.push(rel);
  };
  for (const dir of ['server', 'shared', 'web', 'fixtures']) walk(dir);
  const h = createHash('sha256');
  for (const f of files.sort()) h.update(f).update('\0').update(readFileSync(path.join(REPO, f))).update('\0');
  return h.digest('hex');
}

function gitSha() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || null;
  } catch {
    return null;
  }
}

const readJson = f => JSON.parse(readFileSync(f, 'utf8'));

async function main() {
  const all = matrix();
  let runs = all;
  if (only) {
    const ids = only.split(',').map(s => s.trim()).filter(Boolean);
    const unknown = ids.filter(id => !all.some(r => r.runId === id));
    if (!ids.length || unknown.length) throw new Error(`unknown run id ${unknown.join(', ') || only}`);
    runs = all.filter(r => ids.includes(r.runId));
  }
  const allow = new Set(readJson(ALLOW_LIST));
  // tests/helpers/server.mjs adds one process 'exit' listener per server it starts.
  process.setMaxListeners(runs.length * repeat + 10);
  const browser = await launchBrowser();
  let failed = false;

  try {
    if (capture) {
      mkdirSync(RUNS_DIR, { recursive: true });
      const t0 = Date.now();
      for (const run of runs) {
        const { record, consoleErrors, maskProblems } = await playRun(browser, run);
        if (maskProblems.length) {
          // A non-member value must never become part of the baseline.
          failed = true;
          console.log(`FAIL ${run.runId}: not captured: ${maskProblems.join(' | ')}`);
          continue;
        }
        if (consoleErrors.length) {
          failed = true;
          console.log(`FAIL ${run.runId}: console errors: ${consoleErrors.join(' | ')}`);
        }
        const problem = abortProblem(run, record.abortsFired);
        if (problem) { failed = true; console.log(`FAIL ${run.runId}: ${problem}`); }
        writeFileSync(path.join(RUNS_DIR, `${run.runId}.json`), serialize(record));
        console.log(`captured ${run.runId} (aborts ${record.abortsFired})`);
      }
      const captured = new Set(readdirSync(RUNS_DIR).map(f => f.replace(/\.json$/, '')));
      const manifest = {
        capturedAt: new Date().toISOString(),
        gitSha: gitSha(),
        treeSha256: treeSha256(),
        node: process.version,
        chromium: browser.version(),
        env: LIVE_FAKE_ENV,
        runs: all.map(r => r.runId).filter(id => captured.has(id))
      };
      writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
      console.log(`capture: ${runs.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s; manifest lists ${manifest.runs.length}`);
      return;
    }

    const manifest = readJson(MANIFEST);
    const known = new Set(all.map(r => r.runId));
    for (const id of manifest.runs) if (!known.has(id)) throw new Error(`manifest run ${id} is not in the matrix`);
    if (!only) {
      const missing = all.filter(r => !manifest.runs.includes(r.runId)).map(r => r.runId);
      if (missing.length) throw new Error(`not captured: ${missing.join(', ')}`);
    }

    for (let rep = 1; rep <= repeat; rep++) {
      const t0 = Date.now();
      const dir = path.join(OUT_DIR, String(rep));
      mkdirSync(dir, { recursive: true });
      const digest = createHash('sha256');
      let diffs = 0;
      let allowed = 0;
      for (const run of runs) {
        const expected = readJson(path.join(RUNS_DIR, `${run.runId}.json`));
        let result;
        try {
          result = await playRun(browser, run);
        } catch (err) {
          failed = true;
          console.log(`FAIL ${run.runId}: run error: ${err.message}`);
          continue;
        }
        const { record, consoleErrors, maskProblems } = result;
        writeFileSync(path.join(dir, `${run.runId}.json`), serialize(record));
        digest.update(serialize(comparable(record)));
        const problems = diffRun(expected, record);
        const abort = abortProblem(run, record.abortsFired);
        if (abort) { failed = true; console.log(`FAIL ${run.runId}: ${abort}`); }
        if (consoleErrors.length) { failed = true; console.log(`FAIL ${run.runId}: console errors: ${consoleErrors.join(' | ')}`); }
        if (maskProblems.length) { failed = true; console.log(`FAIL ${run.runId}: membership: ${maskProblems.join(' | ')}`); }
        if (problems.length && allow.has(run.runId)) {
          allowed++;
          console.log(`allow-listed diff ${run.runId} (aborts ${record.abortsFired}):\n  ${problems.join('\n  ')}`);
        } else if (problems.length) {
          diffs++;
          failed = true;
          console.log(`DIFF ${run.runId}:\n  ${problems.join('\n  ')}`);
        } else if (run.abort) {
          console.log(`ok ${run.runId} (aborts ${record.abortsFired})`);
        }
      }
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      console.log(`replay ${rep}/${repeat}: ${runs.length} runs, ${diffs} diffs, ${allowed} allow-listed diffs, digest ${digest.digest('hex').slice(0, 16)}, ${secs} s (output ${dir})`);
    }
  } finally {
    await browser.close();
  }
  console.log(`screenshots: ${SHOTS_DIR}`);
  if (failed) process.exitCode = 1;
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
