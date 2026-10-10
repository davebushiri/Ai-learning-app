// Golden harness: plays one scripted run in Chromium and records what the
// learner sees and hears (F1a-T03a).
//
// Timing contract (thread 0004, architect ruling; tasks.md F1a-T03a):
//   1. page.clock.install() (and a pause) before page.goto, so no app timer
//      fires on its own.
//   2. browser-stubs.js holds every speechSynthesis utterance until we release it.
//   3. Every action is keyed on DOM state ("line N appended", panel visible),
//      never on elapsed time.
//   4. Time moves only through page.clock.runFor, and only while no /api/*
//      request is pending (tracked with request / requestfinished / requestfailed).
//   5. Live-fake runs (F1a-T03b) pin GRADE_DEADLINE_MS / SCENARIO_DEADLINE_MS
//      (LIVE_FAKE_ENV, recorded in manifest.env) and talk to fake Claude.
// The server is spawned only through tests/helpers/server.mjs.

import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../helpers/server.mjs';
import { startFakeClaude } from '../helpers/fake-claude.mjs';
import { MASKS } from './scripts.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUBS = path.join(HERE, 'browser-stubs.js');
export const SHOTS_DIR = path.join(os.tmpdir(), 'golden-shots');

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0); // fixed page clock
const TICK_MS = 250; // shorter than any app delay (900 ms gap, 1500 ms min reading time)
const MAX_TICKS = 4000; // 1000 s of page time: a stalled run fails instead of hanging
const WAIT_MS = 15000; // real-time cap on any single DOM wait
export const LIVE_FAKE_ENV = { GRADE_DEADLINE_MS: 1500, SCENARIO_DEADLINE_MS: 2000 }; // thread 0004 ruling 10, timing item 5

// Abort patterns match the legacy and the F1a URL shapes (thread 0004).
export const ABORT_PATTERNS = {
  'grade-aborted': ['**/api/grade', '**/api/attempts/*/stops'],
  'complete-aborted': ['**/api/attempts/*/complete']
};

// Playwright is installed globally (spec Assumptions: F1a adds no npm dependency).
export function loadPlaywright() {
  const require = createRequire(import.meta.url);
  const paths = [
    path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules'),
    ...(process.env.NODE_PATH ?? '').split(path.delimiter).filter(Boolean)
  ];
  try {
    return require('playwright');
  } catch {
    return require(require.resolve('playwright', { paths }));
  }
}

export async function launchBrowser() {
  const { chromium } = loadPlaywright();
  try {
    return await chromium.launch();
  } catch {
    return chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  }
}

// `Date.now()`-based ids (13-digit ms timestamps) never reach the baseline.
export const normalize = s => String(s).replace(/\b\d{13}\b/g, '<id>');

// Live-generated run only (review OI-10): the scenario prompt draws three
// values at random. Replace each value with <masked> when it belongs to its
// frozen source list; otherwise keep it visible, so a non-member is a diff
// against the baseline's <masked> and is reported as a membership problem.
export function maskDraws(text, problems = []) {
  let out = String(text);
  for (const [label, { list, values }] of Object.entries(MASKS)) {
    out = out.replace(new RegExp(`(^|\\n)(${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})([^\\n]*)`, 'g'), (_, pre, lab, value) => {
      if (values.includes(value)) return `${pre}${lab}<masked>`;
      problems.push(`${label.trim()} ${JSON.stringify(value)} is not in ${list}`);
      return `${pre}${lab}<not in ${list}: ${value}>`;
    });
  }
  return out;
}

// The outbound-prompt layer: one entry per request fake Claude saw, in order.
async function promptLayer(fake, mask, problems) {
  const log = await (await fetch(`${fake.url}/__log`)).json();
  const norm = s => (s == null ? null : normalize(mask ? maskDraws(s, problems) : s));
  return log.map(e => ({ kind: e.kind, system: norm(e.system), user: norm(typeof e.user === 'string' ? e.user : JSON.stringify(e.user)), schemaSha256: e.schemaSha256 }));
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// One DOM snapshot of everything the driver decides on. Runs in the page.
function snapshot() {
  const $ = id => document.getElementById(id);
  const vis = el => Boolean(el && el.checkVisibility());
  const text = el => (el ? el.innerText.replace(/[ \t]+\n/g, '\n').trim() : null);
  const active = document.activeElement;
  return {
    lines: [...document.querySelectorAll('#transcript li')].map(li => ({ text: text(li), cls: li.className })),
    setup: vis($('setup-screen')),
    play: vis($('play-screen')),
    explain: vis($('explain-panel')),
    feedback: vis($('feedback-panel')),
    graderError: vis($('grader-error')),
    // F1a-B20: US3.1 shows #results-error on the results screen, so "results"
    // means the screen is visible and the error is not (as tests/e2e/F1a.e2e.mjs).
    results: vis(document.querySelector('#results-screen:not([hidden])')) && !vis($('results-error')),
    resultsError: vis($('results-error')),
    held: window.__golden.held(),
    listening: window.__golden.listening(),
    spokenCount: window.__golden.spoken.length,
    focus: active && active !== document.body ? active.id || active.tagName.toLowerCase() : 'body'
  };
}

// Visible text of the elements that matter on each screen, as "id: text".
function visibleTexts(ids) {
  const out = [];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (!el || !el.checkVisibility()) continue;
    if (el.tagName === 'SELECT') {
      out.push(`${id}: ${[...el.options].map(o => o.label).join(' | ')}`);
      continue;
    }
    out.push(`${id}: ${el.innerText.replace(/[ \t]+\n/g, '\n').trim()}`);
  }
  return out;
}

// Force layout, then two real (unfaked) macrotask hops, so focus fix-up and
// response handlers have run before we read anything.
async function settle(page) {
  await page.evaluate(() => new Promise(resolve => {
    void document.body.offsetHeight;
    const hop = n => {
      const c = new MessageChannel();
      c.port1.onmessage = () => (n ? hop(n - 1) : resolve());
      c.port2.postMessage(0);
    };
    hop(1);
  }));
}

export async function playRun(browser, run, { shots = true } = {}) {
  const live = run.mode === 'live-fake';
  const fake = live ? await startFakeClaude({ mode: run.fake }) : null;
  const env = live
    ? {
        MOCK: '0', ANTHROPIC_API_KEY: 'sk-fake', ANTHROPIC_BASE_URL: fake.url, DB_PATH: ':memory:',
        GRADE_DEADLINE_MS: String(LIVE_FAKE_ENV.GRADE_DEADLINE_MS), SCENARIO_DEADLINE_MS: String(LIVE_FAKE_ENV.SCENARIO_DEADLINE_MS)
      }
    : { MOCK: '1', DB_PATH: ':memory:' };
  let app;
  try {
    app = await startServer(env);
  } catch (err) {
    await fake?.close();
    throw err;
  }
  const maskProblems = [];
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pending = new Set();
  const consoleErrors = [];
  const abortedUrls = new Set();
  let abortsFired = 0;

  const record = {
    runId: run.runId, mode: run.mode, speech: run.speech, fixture: run.fixture, script: run.script,
    displayed: [], spoken: [], focus: [], points: [], score: null, rating: null, outcomeLine: null,
    grades: [], prompts: [], abortsFired: 0
  };
  const show = lines => record.displayed.push(...lines.map(normalize));

  try {
    const isApi = req => new URL(req.url()).pathname.startsWith('/api/');
    page.on('request', req => { if (isApi(req)) pending.add(req); });
    page.on('requestfinished', req => pending.delete(req));
    page.on('requestfailed', req => pending.delete(req));
    page.on('pageerror', err => consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      // Chromium logs the request we aborted on purpose; that is the test, not an app error.
      if (/^Failed to load resource/.test(msg.text()) && abortedUrls.has(msg.location().url)) return;
      consoleErrors.push(msg.text());
    });

    if (run.abort) {
      let fired = false;
      const abortFirst = async route => {
        if (fired) return route.continue();
        fired = true;
        abortsFired++;
        abortedUrls.add(route.request().url());
        return route.abort('failed');
      };
      for (const pattern of ABORT_PATTERNS[run.abort]) await page.route(pattern, abortFirst);
    }

    await page.clock.install({ time: T0 });
    await page.clock.pauseAt(T0 + 1000);
    await page.addInitScript({ path: STUBS });

    const snap = () => page.evaluate(snapshot);
    const texts = ids => page.evaluate(visibleTexts, ids);
    const until = async (label, pred) => {
      const deadline = Date.now() + WAIT_MS;
      for (;;) {
        if (pending.size === 0) {
          await settle(page);
          const s = await snap();
          if (pred(s)) return s;
        }
        if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
        await sleep(5);
      }
    };
    const runFor = async ms => {
      if (pending.size) throw new Error('timing contract: runFor while an /api request is pending');
      await page.clock.runFor(ms);
    };
    const focus = async () => record.focus.push((await snap()).focus);
    const button = name => page.getByRole('button', { name, exact: true });

    // ---- setup ----
    await page.goto(app.url);
    await until('setup screen with jobs', s => s.setup);
    await page.getByLabel('Job').locator('option').first().waitFor({ state: 'attached', timeout: WAIT_MS });
    await until('setup idle', () => true);
    show(await texts(['mode-badge', 'trade-select', 'setup-msg', 'score']));
    await page.getByLabel('Job').selectOption({ label: run.label });
    await page.getByLabel('Read aloud').setChecked(run.speech === 'voice');
    if (live) await page.getByLabel('Use cached scenario (demo safe)').setChecked(run.card === 'cached');
    await page.getByRole('button', { name: 'Start the job' }).click();
    await until('first line', s => s.play && s.lines.length > 0);
    show(await texts(['job-title', 'job-setting', 'job-source', 'score']));
    await focus();

    // ---- play loop ----
    let seen = 0;
    const stops = [...run.stops];
    let ticks = 0;
    let spokenBeforeResults = 0; // the run-end speech starts in the same task that shows results
    for (;;) {
      const s = await until('idle', () => true);
      if (s.results || s.resultsError) break;
      spokenBeforeResults = s.spokenCount;
      if (s.lines.length > seen) {
        for (const l of s.lines.slice(seen)) show([`line ${++seen}: ${l.text}`]);
        if (stops[0] && stops[0].line === seen) await doStop(stops.shift());
        continue;
      }
      if (run.speech === 'voice' && s.held > 0) {
        await page.evaluate(() => window.__golden.release());
        continue;
      }
      if (++ticks > MAX_TICKS) throw new Error(`stalled after line ${seen}`);
      await runFor(TICK_MS);
    }
    if (stops.length) throw new Error(`run ended before the STOP on line ${stops[0].line}`);

    // ---- results ----
    for (let attempt = 0; ; attempt++) {
      const s = await until('results', x => x.results || x.resultsError);
      if (s.results) break;
      show(await texts(['results-error']));
      await focus();
      if (attempt >= 2) throw new Error('results error persisted');
      await button('Retry results').click();
    }
    show(await texts(['result-rating', 'result-total', 'result-max', 'result-summary', 'missed-heading', 'missed-list', 'results-note', 'score']));
    const final = await snap();
    show(final.lines.map((l, i) => `line ${i + 1} class: ${l.cls}`));
    record.focus.push(final.focus);
    record.rating = normalize(await page.locator('#result-rating').innerText());
    record.score = Number(await page.locator('#score').innerText());
    // Let the run-end speech finish (it may be a chain of utterances).
    while ((await until('results speech', () => true)).held > 0) await page.evaluate(() => window.__golden.release());
    const spoken = await page.evaluate(() => [...window.__golden.spoken]);
    record.spoken = spoken.map(normalize);
    record.outcomeLine = spoken.length > spokenBeforeResults ? normalize(spoken[spokenBeforeResults]) : null;

    if (shots) {
      mkdirSync(SHOTS_DIR, { recursive: true });
      for (const width of [390, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await page.screenshot({ path: path.join(SHOTS_DIR, `${run.runId}-${width}.png`), fullPage: true, animations: 'disabled' });
      }
    }
    if (live) record.prompts = await promptLayer(fake, run.mask, maskProblems);
    record.abortsFired = abortsFired;
    return { record, consoleErrors, maskProblems };

    // ---- one STOP: explain, submit, feedback, back to work ----
    async function doStop({ line, say }) {
      if (run.speech === 'voice') await page.locator('#stop-btn').click();
      else await page.keyboard.press('Space');
      await until(`explain panel for line ${line}`, x => x.explain);
      show(await texts(['explain-panel']));
      await focus();

      if (run.speech === 'voice') {
        await page.getByRole('button', { name: /Talk/ }).click();
        await until('mic listening', x => x.listening > 0);
        await page.evaluate(t => window.__golden.dictate(t), say);
        await page.getByRole('button', { name: /Done talking/ }).click();
        await until('mic stopped', x => x.listening === 0);
        await page.getByRole('button', { name: /Talk/ }).waitFor({ timeout: WAIT_MS });
        show([`explain-input: ${await page.locator('#explain-panel textarea').inputValue()}`]);
        await button('Submit').click();
      } else {
        await page.keyboard.type(say);
        show([`explain-input: ${await page.locator('#explain-panel textarea').inputValue()}`]);
        await page.keyboard.press('Enter');
      }

      for (let attempt = 0; ; attempt++) {
        const x = await until(`feedback for line ${line}`, y => y.feedback || y.graderError);
        if (x.feedback) break;
        show(await texts(['grader-error']));
        await focus();
        if (attempt >= 2) throw new Error('grader error persisted');
        await button('Try again').click();
      }
      show(await texts(['feedback-verdict', 'feedback-text', 'feedback-source', 'feedback-points', 'score']));
      await focus();
      const fb = await page.evaluate(() => ({
        cls: document.getElementById('feedback-verdict').className,
        points: document.getElementById('feedback-points').innerText,
        source: document.getElementById('feedback-source')?.innerText ?? null
      }));
      record.points.push(Number.parseInt(fb.points, 10));
      record.grades.push({ verdict: fb.cls.replace(/^verdict\s*/, ''), source: fb.source?.replace(/^Graded by:\s*/, '') ?? null });

      if (run.speech === 'voice') {
        while ((await until('feedback speech', () => true)).held > 0) await page.evaluate(() => window.__golden.release());
        await button('Back to work').click();
      } else if ((await snap()).focus === 'continue-btn') {
        await page.keyboard.press('Enter');
      } else {
        await button('Back to work').click();
      }
      await until('feedback closed', y => !y.feedback);
    }
  } finally {
    await context.close().catch(() => {});
    await app.stop();
    await fake?.close();
  }
}
