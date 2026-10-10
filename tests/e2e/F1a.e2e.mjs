// F1a-T01b: browser-level acceptance tests (Playwright, outside npm test).
//
//   node tests/e2e/F1a.e2e.mjs
//
// One MOCK server (spawned through tests/helpers/server.mjs on a free port, with a temp-file
// DB_PATH so the skip tests can read what was stored), one Chromium, a fresh context per test.
// Voice tests run at 390 px and text tests at 1280 px; the SC-010 tests cross them over, and
// every test ends with screenshots at both widths (OS temp dir, not committed, not asserted).
// Every test asserts zero console errors.
//
// Timing contract (same as F1a-T03a; tasks.md F1a-T01b):
//   1. page.clock.install() before page.goto.
//   2. tests/golden/browser-stubs.js (reused, not edited) holds every speechSynthesis utterance
//      until the test releases it; cancel() ends held utterances with Chromium's events.
//   3. Actions are keyed on DOM state ("line N appended", panel visible), never on elapsed time.
//   4. Time moves only through page.clock.runFor, and only while no /api/* request is pending.
//      The only exception is the client-timeout tests, which hold the route and run 12 000 ms.
//
// Tests for behavior that doesn't exist yet carry the implementing ticket's ID as their reason
// (thread 0004 mapping rule; tests/acceptance/todo-guardrail.test.js checks it). QA removes a
// ticket's markers when verifying that ticket. Expected values are frozen inline from the spec
// and today's electrical card; nothing here reads product files or calls a legacy route itself.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, ABORT_PATTERNS } from '../golden/harness.mjs';
import { startServer } from '../helpers/server.mjs';
import { leakScan, tempDbPath, eventsFor, triplets, GOOD, STOP_KEYS } from '../acceptance/helpers.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STUBS = path.join(HERE, '..', 'golden', 'browser-stubs.js');
const SHOTS_DIR = path.join(os.tmpdir(), 'f1a-e2e-shots');

const T0 = Date.UTC(2026, 0, 1, 9, 0, 0); // fixed page clock
const TICK_MS = 250; // shorter than any app delay (900 ms gap, 1500 ms minimum reading time)
const MAX_TICKS = 2000;
const WAIT_MS = 8000; // real-time cap on one DOM wait; a wrong state fails instead of hanging
const TEST_TIMEOUT_MS = 120000;
const CLIENT_TIMEOUT_MS = 12000; // FR-031 / FR-032

// ---------------------------------------------------------------------------
// Frozen expectations: spec copy table, US1–US3 numbers, today's electrical card
// ---------------------------------------------------------------------------

const ELECTRICAL = 'Electrical: replace a receptacle';
const COPY = {
  graderFirst: "Couldn't reach the grader. Your answer is still here. Try again, or skip and this stop won't be scored.",
  graderRepeat: "Still can't reach the grader. Try again, or skip this stop.",
  resultsError: "Couldn't load your results yet. Retry to see what you missed and the right way to do it.",
  noJobs: 'No jobs are available right now.',
  note1: "1 stop wasn't graded, so it isn't in your score.",
  cleanRun: 'Clean job. Nobody got hurt.',
  falseAlarm: 'That step was actually fine. Stopping the job costs time, so save the STOP for real hazards.',
  happened: c => `Here's what happened next. ${c}`
};
const LINE4 = "Cover plate's off. Backing out the two mounting screws and pulling the receptacle out of the box.";
const MISTAKE = {
  3: {
    severity: 'critical',
    summary: "Didn't verify the circuit was dead",
    why: 'Lights going out proves nothing about the receptacle. Countertop outlets are usually on separate small-appliance circuits, and panel labels are often wrong.',
    correctAction: "Test the tester on a known live outlet, test the receptacle itself, then test the tester again before touching anything. That's live, dead, live.",
    consequence: 'The outlet was on a different breaker. Danny grabbed the hot conductor while pulling the receptacle out and took 120 volts hand to hand while leaning on a grounded sink.',
    missedPts: -300
  },
  5: {
    severity: 'major',
    summary: 'Installed a non-GFCI receptacle next to a sink',
    correctAction: 'Install a GFCI receptacle, or confirm the circuit is already protected by a GFCI upstream, then push the test button to make sure it trips.',
    consequence: 'Months later a wet toaster cord faulted to ground. Without GFCI protection the homeowner got a shock that a GFCI would have tripped in milliseconds.',
    missedPts: -75
  },
  7: {
    severity: 'minor',
    summary: 'Used backstab connections on a circuit that was already arcing',
    correctAction: 'Wrap each wire clockwise around the side screw terminals, or use the back-wire clamp terminals, and tighten them down to the right torque.',
    consequence: 'The backstab loosened again, and the homeowner called back three weeks later about the same sparking outlet, now scorched.',
    missedPts: -25
  }
};
// A results item as copy (its textContent, whitespace collapsed; CSS may change its case on screen).
const itemText = (label, m) => `${label} ${m.summary}. ${m.consequence} Should have: ${m.correctAction}`;
const missedItem = n => itemText(`${MISTAKE[n].severity} · missed · ${MISTAKE[n].missedPts} pts`, MISTAKE[n]);
const notGradedItem = n => itemText(`${MISTAKE[n].severity} · not graded`, MISTAKE[n]);
const FALSE_ALARM_SAY = 'he should lock it out';
const JUICE_SAY = 'it could still have juice';
const EDITED_SAY = 'he never tested it with a meter, it could still be live';

// ---------------------------------------------------------------------------
// Request classification (both URL shapes, legacy and F1a; thread 0004)
// ---------------------------------------------------------------------------

const KIND = [
  ['stop', /^\/api\/(grade|attempts\/[^/]+\/stops)$/],
  ['complete', /^\/api\/attempts\/[^/]+\/complete$/],
  ['start', /^\/api\/(scenario|attempts)$/]
];
const kindOf = pathname => KIND.find(([, re]) => re.test(pathname))?.[0] ?? 'other';
const scanKind = kind => (kind === 'stop' ? 'stop' : kind === 'complete' ? 'complete' : 'other');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// In-page helpers
// ---------------------------------------------------------------------------

// Added after browser-stubs.js. Logs speak / cancel / listen in order, so a test can see what
// happened between two DOM states (US2.17: cancel before listen), and lets a test deny the mic.
function probe() {
  const log = [];
  const synth = window.speechSynthesis;
  const norm = t => String(t).replace(/\s+/g, ' ').trim();
  const shown = t => norm(document.body ? document.body.innerText : '').includes(norm(t));
  const speak = synth.speak.bind(synth);
  synth.speak = u => { log.push({ type: 'speak', text: String(u.text), shown: shown(u.text) }); speak(u); };
  const cancel = synth.cancel.bind(synth);
  synth.cancel = () => { log.push({ type: 'cancel', held: window.__golden.held() }); cancel(); };
  const recs = [];
  const proto = window.SpeechRecognition.prototype;
  const start = proto.start;
  proto.start = function () {
    log.push({ type: 'listen', held: window.__golden.held(), value: document.getElementById('explain-input')?.value ?? null });
    recs.push(this);
    return start.call(this);
  };
  window.__e2e = {
    log,
    // The browser refuses the microphone: Chromium fires error "not-allowed", then end.
    denyMic() {
      const r = recs[recs.length - 1];
      if (!r || !r.running) return false;
      r._emit('error', { error: 'not-allowed' });
      r.stop();
      return true;
    }
  };
}

function snapshot() {
  const $ = id => document.getElementById(id);
  const vis = el => Boolean(el && el.checkVisibility());
  const active = document.activeElement;
  const select = document.querySelector('#setup-screen select');
  const resultsError = vis($('results-error'));
  return {
    lines: [...document.querySelectorAll('#transcript li')].map(li => ({ text: li.innerText.trim(), cls: [...li.classList] })),
    setup: vis($('setup-screen')),
    play: vis($('play-screen')),
    explain: vis($('explain-panel')),
    feedback: vis($('feedback-panel')),
    graderError: vis($('grader-error')),
    results: vis(document.querySelector('#results-screen:not([hidden])')) && !resultsError,
    resultsError,
    options: select ? select.options.length : 0,
    setupMsg: ($('setup-msg')?.textContent ?? '').trim(),
    startDisabled: Boolean($('start-btn')?.disabled),
    score: ($('score')?.textContent ?? '').trim(),
    held: window.__golden.held(),
    listening: window.__golden.listening(),
    spoken: window.__golden.spoken.length,
    log: window.__e2e.log.length,
    focus: active && active !== document.body ? active.id || active.tagName.toLowerCase() : 'body',
    micLabel: ($('mic-btn')?.textContent ?? '').trim()
  };
}

const brief = s => JSON.stringify({
  lines: s.lines.length, setup: s.setup, play: s.play, explain: s.explain, feedback: s.feedback, graderError: s.graderError,
  results: s.results, resultsError: s.resultsError, setupMsg: s.setupMsg, held: s.held, focus: s.focus
});

// Layout, then two real (unfaked) macrotask hops, so handlers and focus fix-up have run.
function settleInPage() {
  return new Promise(resolve => {
    void document.body.offsetHeight;
    const hop = n => {
      const c = new MessageChannel();
      c.port1.onmessage = () => (n ? hop(n - 1) : resolve());
      c.port2.postMessage(0);
    };
    hop(1);
  });
}

// ---------------------------------------------------------------------------
// Suite fixtures
// ---------------------------------------------------------------------------

let browser;
let app;
let db;
const suiteStart = Date.now();

before(async () => {
  db = tempDbPath();
  app = await startServer({ MOCK: '1', DB_PATH: db.dbPath });
  browser = await launchBrowser();
  mkdirSync(SHOTS_DIR, { recursive: true });
});

after(async () => {
  await browser?.close().catch(() => {});
  await app?.stop();
  db?.cleanup();
});

// ---------------------------------------------------------------------------
// One learner session in one browser context
// ---------------------------------------------------------------------------

class Session {
  constructor({ speech, width }) {
    this.voice = speech === 'voice';
    this.width = width ?? (this.voice ? 390 : 1280);
    this.pending = new Set();
    this.entries = new Map(); // Request → log entry
    this.requests = [];
    this.responses = [];
    this.consoleErrors = [];
    this.injected = new Set(); // URLs we failed on purpose (Chromium logs those; not an app error)
    this.queues = { stop: [], complete: [] };
    this.routed = { stop: false, complete: false };
    this.held = [];
    this.inFlight = { stop: 0, complete: 0 };
    this.maxInFlight = { stop: 0, complete: 0 };
  }

  async open() {
    this.context = await browser.newContext({ viewport: { width: this.width, height: 900 }, reducedMotion: 'reduce' });
    const page = (this.page = await this.context.newPage());
    const isApi = req => new URL(req.url()).pathname.startsWith('/api/');
    const done = req => {
      if (!this.pending.delete(req)) return;
      const e = this.entries.get(req);
      if (e && e.kind in this.inFlight) this.inFlight[e.kind]--;
    };
    page.on('request', req => {
      if (!isApi(req)) return;
      const url = new URL(req.url());
      const e = { method: req.method(), path: url.pathname, url: req.url(), kind: kindOf(url.pathname), body: req.postData() };
      this.pending.add(req);
      this.entries.set(req, e);
      this.requests.push(e);
      if (e.kind in this.inFlight) {
        this.inFlight[e.kind]++;
        this.maxInFlight[e.kind] = Math.max(this.maxInFlight[e.kind], this.inFlight[e.kind]);
      }
    });
    page.on('requestfinished', done);
    page.on('requestfailed', done);
    page.on('response', res => {
      const url = new URL(res.url());
      if (!url.pathname.startsWith('/api/')) return;
      const e = { method: res.request().method(), path: url.pathname, kind: kindOf(url.pathname), status: res.status(), json: undefined };
      e.ready = res.text().then(t => { try { e.json = JSON.parse(t); } catch { e.json = null; } }, () => { e.json = null; });
      this.responses.push(e);
    });
    page.on('pageerror', err => this.consoleErrors.push(`pageerror: ${err.message}`));
    page.on('console', msg => {
      if (msg.type() !== 'error') return;
      if (/^Failed to load resource/.test(msg.text()) && this.injected.has(msg.location().url)) return;
      this.consoleErrors.push(msg.text());
    });
    await page.clock.install({ time: T0 });
    await page.clock.pauseAt(T0 + 1000);
    await page.addInitScript({ path: STUBS });
    await page.addInitScript(probe);
    return this;
  }

  // ---- state ----
  snap() { return this.page.evaluate(snapshot); }

  async until(label, pred, { pending = false } = {}) {
    const end = Date.now() + WAIT_MS;
    let last = null;
    for (;;) {
      if (pending || this.pending.size === 0) {
        await this.page.evaluate(settleInPage);
        last = await this.snap();
        if (pred(last)) return last;
      }
      if (Date.now() > end) throw new Error(`timed out waiting for ${label}; last state ${last ? brief(last) : `(${this.pending.size} /api request(s) pending)`}`);
      await sleep(5);
    }
  }

  async runFor(ms, { allowPending = false } = {}) {
    if (this.pending.size && !allowPending) throw new Error('timing contract: runFor while an /api request is pending');
    await this.page.clock.runFor(ms);
  }

  release() { return this.page.evaluate(() => window.__golden.release()); }
  spoken() { return this.page.evaluate(() => [...window.__golden.spoken]); }
  log() { return this.page.evaluate(() => [...window.__e2e.log]); }
  text(sel) { return this.page.evaluate(s => document.querySelector(s)?.innerText.trim() ?? null, sel); }
  visible(sel) { return this.page.evaluate(s => Boolean(document.querySelector(s)?.checkVisibility()), sel); }
  disabled(sel) { return this.page.evaluate(s => Boolean(document.querySelector(s)?.disabled), sel); }
  value(sel) { return this.page.evaluate(s => document.querySelector(s)?.value ?? null, sel); }

  // Release held speech until none is left. With `clock`, also let short app timers run
  // (the run-end chain may wait between its two utterances).
  async drain({ clock = false } = {}) {
    for (let idle = 0; idle < (clock ? 4 : 1);) {
      const s = await this.until('speech', () => true);
      if (s.held > 0) { await this.release(); idle = 0; continue; }
      idle++;
      if (clock) await this.runFor(TICK_MS);
    }
  }

  // ---- network ----
  async responsesOf(kind) {
    await Promise.all(this.responses.map(r => r.ready));
    return kind ? this.responses.filter(r => r.kind === kind) : [...this.responses];
  }
  requestsOf(kind) { return this.requests.filter(r => r.kind === kind); }
  attemptId() {
    return this.responsesOf('start').then(rs => rs.map(r => r.json?.attemptId).filter(Boolean).at(-1));
  }

  // Fails the next STOP or complete requests, in order. Behaviors: 'abort' (network error),
  // {status} (fulfilled with that status), 'hold' (never answered until released), 'lose'
  // (sent to the server, response dropped), or a function(route). Afterwards requests pass.
  async inject(kind, ...behaviors) {
    this.queues[kind].push(...behaviors);
    if (this.routed[kind]) return;
    this.routed[kind] = true;
    const handler = async route => {
      const b = this.queues[kind].shift();
      const url = route.request().url();
      if (b === undefined) return route.continue();
      if (b === 'hold') { this.held.push(route); return; }
      if (typeof b === 'function') return b(route);
      this.injected.add(url);
      if (b === 'abort') return route.abort('failed');
      if (b === 'lose') { await route.fetch(); return route.abort('failed'); }
      return route.fulfill({ status: b.status, contentType: 'application/json', body: JSON.stringify(b.body ?? { error: 'injected' }) });
    };
    const patterns = ABORT_PATTERNS[kind === 'stop' ? 'grade-aborted' : 'complete-aborted'];
    for (const p of patterns) await this.page.route(p, handler);
  }

  async waitHeld(n = 1) {
    const end = Date.now() + WAIT_MS;
    while (this.held.length < n) {
      if (Date.now() > end) throw new Error(`expected ${n} held request(s), have ${this.held.length}`);
      await sleep(5);
    }
  }

  async releaseHeld(how = 'continue') {
    const route = this.held.shift();
    assert.ok(route, 'a held request to release');
    if (how === 'abort') this.injected.add(route.request().url());
    await (how === 'abort' ? route.abort('failed') : route.continue()).catch(() => {}); // already aborted by the page: fine
  }

  async fulfilJson(pathname, json) {
    await this.page.route(url => url.pathname === pathname, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(json) }));
  }

  async abortPath(test) {
    await this.page.route(url => test(url.pathname), route => { this.injected.add(route.request().url()); return route.abort('failed'); });
  }

  // ---- learner actions ----
  async goto() {
    await this.page.goto(app.url);
    return this.until('setup screen ready', s => s.setup && (s.options > 0 || s.setupMsg !== ''));
  }

  async begin({ label = ELECTRICAL, goto = true } = {}) {
    if (goto) await this.goto();
    await this.page.getByLabel('Job').selectOption({ label });
    await this.page.getByLabel('Read aloud').setChecked(this.voice);
    await this.page.getByRole('button', { name: 'Start the job' }).click();
    return this.until('first line', s => (s.play && s.lines.length > 0) || s.setupMsg.startsWith("Couldn't"));
  }

  // Returns once line n has been appended (in voice mode its utterance is still held).
  async playTo(n) {
    for (let ticks = 0; ;) {
      const s = await this.until(`line ${n}`, () => true);
      if (s.lines.length >= n) return s;
      if (s.results || s.resultsError || !s.play) throw new Error(`run left the play screen before line ${n}: ${brief(s)}`);
      if (this.voice && s.held > 0) { await this.release(); continue; }
      if (++ticks > MAX_TICKS) throw new Error(`stalled before line ${n}`);
      await this.runFor(TICK_MS);
    }
  }

  async playToEnd() {
    for (let ticks = 0; ;) {
      const s = await this.until('end of run', () => true);
      if (s.results || s.resultsError) return s;
      if (!s.play) throw new Error(`left the play screen before the end: ${brief(s)}`);
      if (s.explain || s.feedback || s.graderError) throw new Error(`a panel is open, the run can't end: ${brief(s)}`);
      if (this.voice && s.held > 0) { await this.release(); continue; }
      if (++ticks > MAX_TICKS) throw new Error('stalled before the end of the run');
      await this.runFor(TICK_MS);
    }
  }

  async pressStop() {
    if (this.voice) await this.page.locator('#stop-btn').click();
    else await this.page.keyboard.press('Space');
    return this.until('explain panel', s => s.explain);
  }

  async explain(say) {
    if (this.voice) {
      await this.page.locator('#mic-btn').click();
      await this.until('mic listening', s => s.listening > 0);
      await this.page.evaluate(t => window.__golden.dictate(t), say);
      await this.page.locator('#mic-btn').click();
      await this.until('mic stopped', s => s.listening === 0 && /Talk/.test(s.micLabel));
    } else if (say.length > 200) {
      await this.page.locator('#explain-input').fill(say);
    } else {
      await this.page.keyboard.type(say);
    }
    assert.equal(await this.value('#explain-input'), say, 'the explanation is in the textbox');
  }

  async submit() {
    if (this.voice) await this.page.locator('#submit-btn').click();
    else await this.page.keyboard.press('Enter');
  }

  afterSubmit() { return this.until('feedback or grader error', s => s.feedback || s.graderError); }

  async stopAndExplain(line, say) {
    await this.playTo(line);
    await this.pressStop();
    await this.explain(say);
    await this.submit();
    return this.afterSubmit();
  }

  async feedback() {
    return this.page.evaluate(() => {
      const t = id => document.getElementById(id)?.innerText.trim() ?? null;
      return { verdict: t('feedback-verdict'), text: t('feedback-text'), points: t('feedback-points'), source: t('feedback-source') };
    });
  }

  async backToWork() {
    if (this.voice) {
      await this.drain();
      await this.page.locator('#continue-btn').click();
    } else if ((await this.snap()).focus === 'continue-btn') {
      await this.page.keyboard.press('Enter');
    } else {
      await this.page.locator('#continue-btn').click();
    }
    return this.until('feedback closed', s => !s.feedback);
  }

  // A STOP that must be graded: returns what the feedback panel showed.
  async catchLine(line, say) {
    const s = await this.stopAndExplain(line, say);
    assert.ok(s.feedback, `feedback for the STOP on line ${line}: ${brief(s)}`);
    const fb = await this.feedback();
    await this.backToWork();
    return fb;
  }

  async press(sel) {
    if (this.voice) await this.page.locator(sel).click();
    else { await this.page.locator(sel).focus(); await this.page.keyboard.press('Enter'); }
  }

  async skip() {
    await this.press('#skip-stop-btn');
    return this.until('grader panel closed', s => !s.graderError);
  }

  async results() {
    return this.page.evaluate(() => {
      const t = id => document.getElementById(id)?.innerText.trim() ?? null;
      const vis = id => Boolean(document.getElementById(id)?.checkVisibility());
      return {
        rating: t('result-rating'), total: t('result-total'), max: t('result-max'), summary: t('result-summary'),
        missedHeading: vis('missed-heading'),
        items: [...document.querySelectorAll('#missed-list li')].map(li => ({ text: li.textContent.replace(/\s+/g, ' ').trim(), cls: [...li.classList] })),
        note: vis('results-note') ? t('results-note') : null,
        score: t('score')
      };
    });
  }

  async screenshots(name) {
    const slug = name.replace(/[^A-Za-z0-9]+/g, '-').slice(0, 80);
    for (const width of [390, 1280]) {
      await this.page.setViewportSize({ width, height: 900 });
      await this.page.screenshot({ path: path.join(SHOTS_DIR, `${slug}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }

  async close() { await this.context?.close().catch(() => {}); }
}

// Registers one browser test. `opts` carries speech/width plus node:test options (the ticket
// reason is passed straight through).
function e2e(name, opts, fn) {
  const { speech, width, ...testOpts } = opts;
  test(name, { ...testOpts, timeout: TEST_TIMEOUT_MS }, async () => {
    const s = await new Session({ speech, width }).open();
    try {
      await fn(s);
      await s.screenshots(name);
      assert.deepEqual(s.consoleErrors, [], 'zero console errors');
    } finally {
      await s.close();
    }
  });
}

// ---------------------------------------------------------------------------
// Shared assertions
// ---------------------------------------------------------------------------

function assertFeedback(fb, { verdict, text, points, source = 'Graded by: keyword grader' }) {
  assert.equal(fb.verdict, verdict, 'verdict label');
  assert.equal(fb.text, text, 'feedback text');
  assert.equal(fb.points, points, 'points');
  assert.equal(fb.source, source, 'grade source');
}

const lineClasses = s => s.lines.map(l => l.cls.filter(c => c === 'caught' || c === 'false-alarm'));

// FR-011 in the browser: no /api/* response before each STOP response holds an answer field,
// and the STOP response itself carries only the credited mistake's allowed fields.
async function assertNoLeakBeforeStops(s) {
  const rs = await s.responsesOf();
  const stops = rs.map((r, i) => (r.kind === 'stop' ? i : -1)).filter(i => i >= 0);
  assert.ok(stops.length > 0, 'at least one STOP response was received');
  for (const i of stops) {
    for (const r of rs.slice(0, i + 1)) {
      assert.deepEqual(leakScan(r.json, { kind: scanKind(r.kind) }), [], `${r.method} ${r.path} (before STOP response #${stops.indexOf(i) + 1})`);
    }
  }
}

function assertGraderPanelCopy(s, copy) {
  return s.text('#grader-error-msg').then(t => assert.equal(t, copy, '#grader-error-msg copy'));
}

const count = (arr, x) => arr.filter(y => y === x).length;

// ===========================================================================
// US1: play a card whose answers stay on the server
// ===========================================================================

for (const speech of ['voice', 'text']) {
  const v = speech === 'voice';
  const id = (vn, tn) => (v ? vn : tn);

  e2e(`${id('US1.1', 'US1.2')} ${speech}: STOP during line 3 and explain: Good catch!, feedback, +270 points, keyword grader, line 3 caught, score 270${v ? ', feedback spoken as displayed' : ', speak never called'}`, { speech }, async s => {
    await s.begin();
    const st = await s.stopAndExplain(3, GOOD[3]);
    assert.ok(st.feedback, 'feedback panel shown');
    const fb = await s.feedback();
    assertFeedback(fb, { verdict: 'Good catch!', text: `Good catch. ${MISTAKE[3].why}`, points: '+270 points' });
    assert.deepEqual(lineClasses(st)[2], ['caught'], 'line 3 is caught');
    assert.equal(st.score, '270', 'top-bar score');
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), fb.text, 'the string spoken for feedback equals #feedback-text');
    else assert.deepEqual(spoken, [], 'speechSynthesis.speak is never called');
  });

  e2e(`${id('US1.1', 'US1.2')} ${speech}: no response before the STOP response holds an answer field, and the score equals the STOP response's total`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.begin();
    const st = await s.stopAndExplain(3, GOOD[3]);
    assert.ok(st.feedback, 'feedback panel shown');
    await assertNoLeakBeforeStops(s);
    const [stop] = await s.responsesOf('stop');
    assert.equal(stop.json?.total, 270, 'STOP response total');
    assert.equal(st.score, String(stop.json.total), 'top-bar score equals the STOP response total');
  });

  e2e(`${id('US1.3', 'US1.4 + US6.4')} ${speech}: STOP during line 1: False alarm, the pack's false-alarm feedback, -75 points, line 1 false-alarm${v ? ', spoken as displayed' : ', nothing spoken'}`, { speech }, async s => {
    await s.begin();
    const st = await s.stopAndExplain(1, FALSE_ALARM_SAY);
    assert.ok(st.feedback, 'feedback panel shown');
    const fb = await s.feedback();
    assertFeedback(fb, { verdict: 'False alarm', text: COPY.falseAlarm, points: '-75 points' });
    assert.deepEqual(lineClasses(st)[0], ['false-alarm'], 'line 1 is a false alarm');
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), fb.text, 'feedback spoken exactly as displayed');
    else assert.deepEqual(spoken, [], 'nothing spoken');
  });

  e2e(`${id('US1.5', 'US1.6')} ${speech}: STOP during line 4 credits line 3 one line late: line 3 caught, line 4 unmarked, +135 points`, { speech }, async s => {
    await s.begin();
    const st = await s.stopAndExplain(4, GOOD[3]);
    assert.ok(st.feedback, 'feedback panel shown');
    assertFeedback(await s.feedback(), { verdict: 'Good catch!', text: `Good catch. ${MISTAKE[3].why}`, points: '+135 points' });
    assert.deepEqual(lineClasses(st).slice(2, 4), [['caught'], []], 'line 3 caught, line 4 not marked');
    if (!v) assert.deepEqual(await s.spoken(), [], 'nothing spoken');
  });

  e2e(`${id('US1.7', 'US1.8')} + ${id('US6.1', 'US6.2')} ${speech}: never stop: Someone got hurt, -400 / 600, Caught 0 of 3 mistakes · 0 false alarms, three missed items${v ? ', critical consequence spoken' : ', nothing spoken'}`, { speech }, async s => {
    await s.begin();
    await s.playToEnd();
    const r = await s.results();
    assert.equal(r.rating, 'Someone got hurt');
    assert.equal(r.total, '-400');
    assert.equal(r.max, '600');
    assert.equal(r.summary, 'Caught 0 of 3 mistakes · 0 false alarms');
    assert.deepEqual(r.items.map(i => i.text), [missedItem(3), missedItem(5), missedItem(7)]);
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), COPY.happened(MISTAKE[3].consequence));
    else assert.deepEqual(spoken, [], 'nothing spoken');
  });

  e2e(`${id('US1.7', 'US1.8')} ${speech}: every results value comes from the complete response`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.begin();
    await s.playToEnd();
    const r = await s.results();
    const [c] = await s.responsesOf('complete');
    assert.ok(c?.json, 'a complete response was received');
    const j = c.json;
    assert.equal(r.rating, j.ratingLabel);
    assert.equal(r.total, String(j.total));
    assert.equal(r.max, String(j.maxPossible));
    assert.equal(r.summary, `Caught ${j.caughtCount} of ${j.mistakeCount} mistakes · ${j.falseAlarms} false alarm${j.falseAlarms === 1 ? '' : 's'}`);
    assert.deepEqual(r.items.map(i => i.text), j.missed.map(m => itemText(`${m.severity} · missed · ${m.points} pts`, m)));
  });

  e2e(`${id('US1.9 + US6.3', 'US1.10')} ${speech}: perfect run: Journeyman eyes, 540 / 600${v ? ', the clean-run line spoken' : ', nothing spoken'}`, { speech }, async s => {
    await s.begin();
    for (const n of [3, 5, 7]) await s.catchLine(n, GOOD[n]);
    await s.playToEnd();
    const r = await s.results();
    assert.equal(r.rating, 'Journeyman eyes');
    assert.equal(r.total, '540');
    assert.equal(r.max, '600');
    assert.equal(r.summary, 'Caught 3 of 3 mistakes · 0 false alarms');
    assert.deepEqual(r.items, []);
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), COPY.cleanRun);
    else assert.deepEqual(spoken, [], 'nothing spoken');
  });

  e2e(`${id('US1.11', 'US1.12')} empty subjects list shows No jobs are available right now. with 0 console errors (${speech})`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.fulfilJson('/api/subjects', []);
    await s.page.goto(app.url);
    await s.page.getByLabel('Read aloud').setChecked(v);
    const st = await s.until('setup settled', x => x.setup && (x.options > 0 || x.setupMsg !== ''));
    assert.equal(st.setupMsg, COPY.noJobs, '#setup-msg');
    assert.equal(st.startDisabled, true, 'Start the job is disabled');
    assert.deepEqual(await s.spoken(), [], 'nothing spoken');
  });

  e2e(`${id('US1.11', 'US1.12')} empty scenarios list shows No jobs are available right now. (${speech})`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.fulfilJson('/api/scenarios', []);
    await s.page.goto(app.url);
    const st = await s.until('setup settled', x => x.setup && (x.options > 0 || x.setupMsg !== ''));
    assert.equal(st.setupMsg, COPY.noJobs, '#setup-msg');
    assert.equal(st.startDisabled, true, 'Start the job is disabled');
    assert.deepEqual(await s.spoken(), [], 'nothing spoken');
  });

  e2e(`US1 ${speech}: the STOP response for a false alarm has caught null and only the STOP keys`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.begin();
    await s.stopAndExplain(1, FALSE_ALARM_SAY);
    const [stop] = await s.responsesOf('stop');
    assert.ok(stop?.json, 'a STOP response');
    assert.equal(stop.json.caught, null, 'caught: null');
    assert.deepEqual(Object.keys(stop.json).sort(), STOP_KEYS, 'no field names or locates another mistake');
    assert.deepEqual(leakScan(stop.json, { kind: 'stop' }), []);
  });

  e2e(`US1 ${speech}: the STOP response for a late catch credits step 3 with stepsLate 1`, { speech, todo: 'F1a-T17b' }, async s => {
    await s.begin();
    await s.stopAndExplain(4, GOOD[3]);
    const [stop] = await s.responsesOf('stop');
    assert.equal(stop?.json?.caught?.errorStepId, 3);
    assert.equal(stop.json.caught.stepsLate, 1);
    assert.equal(stop.json.points, 135);
  });

  // US6.5 / US6.6: the pack's synonyms map "juice" to "live"; today's verdict is partial (0.4).
  e2e(`${id('US6.5', 'US6.6')} ${speech}: "${JUICE_SAY}" on line 3 gets today's verdict: Close…, +210 points, fix appended`, { speech }, async s => {
    await s.begin();
    const st = await s.stopAndExplain(3, JUICE_SAY);
    assert.ok(st.feedback, 'feedback panel shown');
    assertFeedback(await s.feedback(), {
      verdict: 'Close…',
      text: `You're onto it. ${MISTAKE[3].why} Here's the right way: ${MISTAKE[3].correctAction}`,
      points: '+210 points'
    });
  });
}

// ===========================================================================
// US2: the grader can't be reached
// ===========================================================================

for (const speech of ['voice', 'text']) {
  const v = speech === 'voice';
  const id = (vn, tn) => (v ? vn : tn);

  // A STOP on line 3 with GOOD[3], failing as given. Returns the state with the panel showing.
  const failedStop = async (s, ...behaviors) => {
    await s.begin();
    await s.inject('stop', ...behaviors);
    const st = await s.stopAndExplain(3, GOOD[3]);
    assert.ok(st.graderError, `grader-error panel shown: ${brief(st)}`);
    return st;
  };

  const assertFirstPanel = async (s, st, { focus }) => {
    await assertGraderPanelCopy(s, COPY.graderFirst);
    assert.equal(await s.text('#retry-grade-btn'), 'Try again');
    assert.equal(await s.text('#skip-stop-btn'), 'Skip this stop');
    assert.equal(await s.visible('#explain-input'), true, 'the explanation textbox is still visible');
    assert.equal(await s.value('#explain-input'), GOOD[3], 'the learner\'s text is kept');
    assert.equal(st.focus, focus, 'focus');
    assert.equal(st.score, '0', 'score unchanged');
    assert.deepEqual(lineClasses(st).flat(), [], 'no line marked');
    const spoken = await s.spoken();
    if (v) assert.equal(count(spoken, COPY.graderFirst), 1, 'the sentence is spoken once');
    else assert.deepEqual(spoken, [], 'nothing spoken');
  };

  e2e(`${id('US2.1', 'US2.2')} ${speech}: an aborted STOP request shows #grader-error with the copy, keeps the text, focus on Try again, score unchanged, no line marked`, { speech, todo: 'F1a-T17c' }, async s => {
    const st = await failedStop(s, 'abort');
    await assertFirstPanel(s, st, { focus: 'retry-grade-btn' });
  });

  e2e(`${id('US2.1', 'US2.2')} ${speech}: a 500 on the STOP request shows the same panel with focus on Try again`, { speech, todo: 'F1a-T17c' }, async s => {
    const st = await failedStop(s, { status: 500, body: { error: 'server error' } });
    await assertFirstPanel(s, st, { focus: 'retry-grade-btn' });
  });

  e2e(`${id('US2.3', 'US2.4')} ${speech}: Try again after a failure shows the normal feedback${v ? ' spoken as displayed' : ', no speech'}, and the server holds one triplet`, { speech, todo: 'F1a-T17c' }, async s => {
    await failedStop(s, 'abort');
    await s.press('#retry-grade-btn');
    const st = await s.afterSubmit();
    assert.ok(st.feedback, 'feedback panel after Try again');
    const fb = await s.feedback();
    assertFeedback(fb, { verdict: 'Good catch!', text: `Good catch. ${MISTAKE[3].why}`, points: '+270 points' });
    assert.deepEqual(lineClasses(st)[2], ['caught']);
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), fb.text);
    else assert.deepEqual(spoken, []);
    assert.deepEqual(triplets(eventsFor(db.dbPath, await s.attemptId())), { 3: ['stopped', 'explained', 'graded'] });
  });

  e2e(`US2.5 Skip half (${speech}): Skip closes the panel, adds no points, resumes at line 4 and focuses #stop-btn`, { speech, todo: 'F1a-T17c' }, async s => {
    await failedStop(s, 'abort');
    let st = await s.skip();
    assert.equal(st.explain, false, 'explain panel closed');
    assert.equal(st.score, '0', 'no points added');
    assert.equal(st.focus, 'stop-btn', 'focus on #stop-btn after Skip');
    assert.equal(await s.disabled('#stop-btn'), false, 'STOP enabled again');
    st = await s.playTo(4);
    assert.equal(st.lines.length, 4, 'narration resumes with line 4');
    assert.ok(st.lines[3].text.endsWith(LINE4), 'line 4 is the next line');
  });

  e2e(`${id('US2.5', 'US2.6')} skip on the critical line: skippedStepIds [3] sent and stored, line 3 critical · not graded, total -100, max 300, results note shown${v ? ' and spoken' : ', nothing spoken'}, focus on #stop-btn after Skip (${speech})`, { speech, todo: 'F1a-T17d' }, async s => {
    await failedStop(s, 'abort');
    const st = await s.skip();
    assert.equal(st.focus, 'stop-btn', 'focus on #stop-btn after Skip');
    await s.playToEnd();
    const [req] = s.requestsOf('complete');
    assert.deepEqual(JSON.parse(req.body).skippedStepIds, [3], 'complete body skippedStepIds');
    const r = await s.results();
    assert.equal(r.rating, 'Back to the classroom');
    assert.equal(r.total, '-100');
    assert.equal(r.max, '300');
    assert.equal(r.summary, 'Caught 0 of 3 mistakes · 0 false alarms');
    assert.deepEqual(r.items.map(i => i.text), [notGradedItem(3), missedItem(5), missedItem(7)]);
    assert.equal(r.note, COPY.note1, '#results-note');
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    if (v) assert.deepEqual(spoken.slice(-2), [COPY.happened(MISTAKE[5].consequence), COPY.note1]);
    else assert.deepEqual(spoken, []);
    const completed = eventsFor(db.dbPath, await s.attemptId()).find(e => e.verb === 'completed');
    assert.deepEqual(completed?.result?.skippedStepIds, [3], 'stored completed.result.skippedStepIds');
  });

  e2e(`${id('US2.7', 'US2.8')} skip on a clean line costs no false alarm (${speech})`, { speech, todo: 'F1a-T17d' }, async s => {
    await s.begin();
    await s.inject('stop', 'abort');
    const st = await s.stopAndExplain(1, FALSE_ALARM_SAY);
    assert.ok(st.graderError, 'grader-error panel shown');
    await s.skip();
    for (const n of [3, 5, 7]) await s.catchLine(n, GOOD[n]);
    await s.playToEnd();
    const r = await s.results();
    assert.equal(r.rating, 'Journeyman eyes');
    assert.equal(r.total, '540', 'no -75');
    assert.equal(r.summary, 'Caught 3 of 3 mistakes · 0 false alarms');
    assert.deepEqual(r.items, [], 'no item labelled not graded');
    assert.equal(r.note, COPY.note1);
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    if (v) assert.deepEqual(spoken.slice(-2), [COPY.cleanRun, COPY.note1]);
    else assert.deepEqual(spoken, []);
  });

  e2e(`${id('US2.9', 'US2.10')} nothing truly missed but one not graded: clean-run line not spoken (${speech})`, { speech, todo: 'F1a-T17d' }, async s => {
    await failedStop(s, 'abort');
    await s.skip();
    for (const n of [5, 7]) await s.catchLine(n, GOOD[n]);
    await s.playToEnd();
    const r = await s.results();
    assert.deepEqual(r.items.map(i => i.text), [notGradedItem(3)]);
    assert.equal(r.total, '270');
    assert.equal(r.max, '300');
    assert.equal(r.note, COPY.note1);
    const before = (await s.spoken()).length;
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    assert.equal(spoken.includes(COPY.cleanRun), false, 'the clean-run line is not spoken');
    if (v) assert.deepEqual(spoken.slice(before - 1), [COPY.note1], 'only the note is spoken at run end');
    else assert.deepEqual(spoken, []);
  });

  e2e(`${id('US2.11', 'US2.12')} ${speech}: Try again fails again: the repeat copy${v ? ' spoken once' : ', not spoken'}, focus on Skip this stop`, { speech, todo: 'F1a-T17c' }, async s => {
    await failedStop(s, 'abort', 'abort');
    await s.press('#retry-grade-btn');
    const st = await s.until('repeat panel', x => x.graderError && x.focus === 'skip-stop-btn' || x.feedback);
    assert.ok(st.graderError, 'panel still showing');
    await assertGraderPanelCopy(s, COPY.graderRepeat);
    assert.equal(st.focus, 'skip-stop-btn');
    const spoken = await s.spoken();
    if (v) assert.equal(count(spoken, COPY.graderRepeat), 1);
    else assert.deepEqual(spoken, []);
  });

  e2e(`US2.13 4xx focuses Skip this stop (${speech}, ${v ? 400 : 409})`, { speech, todo: 'F1a-T17c' }, async s => {
    const st = await failedStop(s, { status: v ? 400 : 409, body: { error: 'injected' } });
    await assertGraderPanelCopy(s, COPY.graderFirst);
    assert.equal(st.focus, 'skip-stop-btn');
    const spoken = await s.spoken();
    if (v) assert.equal(count(spoken, COPY.graderFirst), 1);
    else assert.deepEqual(spoken, []);
  });

  e2e(`${id('US2.15', 'US2.16')} Skip, Submit and mic are disabled while a STOP request is pending (${speech})`, { speech, todo: 'F1a-T17c' }, async s => {
    await s.begin();
    await s.inject('stop', 'hold');
    await s.playTo(3);
    await s.pressStop();
    await s.explain(GOOD[3]);
    await s.submit();
    await s.waitHeld(1);
    const log0 = (await s.log()).length;
    // First send pending: Submit, Enter and the mic do nothing.
    assert.equal(await s.disabled('#submit-btn'), true, 'Submit disabled while pending');
    assert.equal(await s.disabled('#mic-btn'), true, 'mic disabled while pending');
    await s.page.locator('#submit-btn').click({ force: true });
    await s.page.locator('#explain-input').focus().catch(() => {});
    await s.page.keyboard.press('Enter');
    await s.page.locator('#mic-btn').click({ force: true });
    let st = await s.until('pending', () => true, { pending: true });
    assert.equal(st.listening, 0, 'the mic did not start');
    assert.equal(s.requestsOf('stop').length, 1, 'one STOP request');
    await s.releaseHeld('abort');
    st = await s.afterSubmit();
    assert.ok(st.graderError, 'panel after the failure');
    // Try again pending: every control is disabled.
    await s.inject('stop', 'hold');
    await s.page.locator('#retry-grade-btn').click();
    await s.waitHeld(1);
    for (const sel of ['#retry-grade-btn', '#skip-stop-btn', '#submit-btn', '#mic-btn']) {
      assert.equal(await s.disabled(sel), true, `${sel} disabled while pending`);
    }
    for (const sel of ['#retry-grade-btn', '#retry-grade-btn', '#submit-btn', '#mic-btn', '#skip-stop-btn']) {
      await s.page.locator(sel).click({ force: true });
    }
    await s.page.locator('#explain-input').focus().catch(() => {});
    await s.page.keyboard.press('Enter');
    st = await s.until('pending', () => true, { pending: true });
    assert.equal(st.graderError, true, 'Skip did nothing while pending');
    assert.equal(st.listening, 0);
    assert.equal(s.requestsOf('stop').length, 2, 'exactly one request per send');
    assert.equal(s.maxInFlight.stop, 1, 'never more than one STOP request in flight');
    const unshown = (await s.log()).slice(log0).filter(e => e.type === 'speak' && !e.shown);
    assert.deepEqual(unshown, [], 'nothing spoken that isn\'t displayed');
    await s.releaseHeld();
    st = await s.afterSubmit();
    assert.ok(st.feedback, 'normal feedback once the request settles');
    if (!v) assert.deepEqual(await s.spoken(), []);
  });

  e2e(`US2.18 ${speech}: ${v ? 'Submit' : 'Enter'} in the error state runs Try again with the edited text`, { speech, todo: 'F1a-T17c' }, async s => {
    await failedStop(s, 'abort');
    await s.page.locator('#explain-input').fill(EDITED_SAY);
    if (v) await s.page.locator('#submit-btn').click();
    else { await s.page.locator('#explain-input').focus(); await s.page.keyboard.press('Enter'); }
    const st = await s.afterSubmit();
    assert.ok(st.feedback, 'normal feedback after the retry');
    const stops = s.requestsOf('stop');
    assert.equal(stops.length, 2, 'a second STOP request was sent');
    assert.equal(JSON.parse(stops[1].body).explanation, EDITED_SAY, 'with the edited text');
  });

  e2e(`US2.14 ${speech}: lost response then skip: the server's graded STOP stands and no results note`, { speech, todo: 'F1a-T17d' }, async s => {
    await failedStop(s, 'lose');
    await s.skip();
    await s.playToEnd();
    const r = await s.results();
    assert.equal(r.summary, 'Caught 1 of 3 mistakes · 0 false alarms', 'the graded STOP counts');
    assert.equal(r.total, '170');
    assert.deepEqual(r.items.map(i => i.text), [missedItem(5), missedItem(7)]);
    assert.equal(r.note, null, 'no results note: the server graded that stop');
    const [c] = await s.responsesOf('complete');
    assert.deepEqual(c.json.skippedStepIds, [], 'effective skippedStepIds');
  });
}

e2e('US2.1 STOP client timeout at 12 000 ms shows the panel', { speech: 'voice', todo: 'F1a-T17c' }, async s => {
  await s.begin();
  await s.inject('stop', 'hold');
  await s.playTo(3);
  await s.pressStop();
  await s.explain(GOOD[3]);
  await s.submit();
  await s.waitHeld(1);
  await s.runFor(CLIENT_TIMEOUT_MS - 1, { allowPending: true });
  let st = await s.until('before the timeout', () => true, { pending: true });
  assert.equal(st.graderError, false, 'no panel at 11 999 ms');
  await s.runFor(1, { allowPending: true });
  st = await s.until('panel after the timeout', x => x.graderError || x.feedback);
  assert.ok(st.graderError, 'panel at 12 000 ms');
  await assertGraderPanelCopy(s, COPY.graderFirst);
  assert.equal(st.focus, 'retry-grade-btn');
  await s.releaseHeld().catch(() => {});
});

e2e('a double press on Try again sends one request', { speech: 'text', todo: 'F1a-T17c' }, async s => {
  await s.begin();
  await s.inject('stop', 'abort', 'hold');
  const st = await s.stopAndExplain(3, GOOD[3]);
  assert.ok(st.graderError, 'panel shown');
  await s.page.locator('#retry-grade-btn').dblclick();
  await s.waitHeld(1);
  await s.until('pending', () => true, { pending: true });
  assert.equal(s.requestsOf('stop').length, 2, 'the failed send plus one retry');
  await s.releaseHeld();
  const after = await s.afterSubmit();
  assert.ok(after.feedback, 'feedback shown');
  assert.equal(s.requestsOf('stop').length, 2, 'still one retry request');
});

e2e('US2.17 mic during the spoken error cancels speech before listening', { speech: 'voice', todo: 'F1a-T17c' }, async s => {
  await s.begin();
  await s.inject('stop', 'abort');
  const st = await s.stopAndExplain(3, GOOD[3]);
  assert.ok(st.graderError, 'panel shown');
  assert.ok(st.held > 0, 'the error sentence is being spoken');
  assert.equal((await s.log()).filter(e => e.type === 'speak').at(-1)?.text, COPY.graderFirst);
  const log0 = (await s.log()).length;
  await s.page.locator('#mic-btn').click();
  await s.until('listening', x => x.listening > 0);
  const events = (await s.log()).slice(log0);
  const iListen = events.findIndex(e => e.type === 'listen');
  assert.ok(iListen >= 0, 'recognition started');
  assert.ok(events.slice(0, iListen).some(e => e.type === 'cancel'), 'cancel() before listen()');
  assert.equal(events[iListen].held, 0, 'no utterance is held when recognition starts');
  assert.equal(events[iListen].value, GOOD[3], 'the textbox still holds the learner\'s words');
});

e2e('FR-049 grader panel: role=alert on #grader-error-msg, aria-describedby from Try again and Skip this stop', { speech: 'text', todo: 'F1a-T17c' }, async s => {
  await s.goto();
  const a = await s.page.evaluate(() => {
    const $ = id => document.getElementById(id);
    return { role: $('grader-error-msg')?.getAttribute('role') ?? null, retry: $('retry-grade-btn')?.getAttribute('aria-describedby') ?? null, skip: $('skip-stop-btn')?.getAttribute('aria-describedby') ?? null };
  });
  assert.deepEqual(a, { role: 'alert', retry: 'grader-error-msg', skip: 'grader-error-msg' });
});

e2e('layout: at 390 px the grader-error message, textbox and both buttons are inside the viewport', { speech: 'text', width: 390, todo: 'F1a-T17c' }, async s => {
  await s.begin();
  await s.inject('stop', 'abort');
  const st = await s.stopAndExplain(3, GOOD[3]);
  assert.ok(st.graderError, 'panel shown');
  const boxes = await s.page.evaluate(sels => sels.map(sel => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return { sel, inside: Boolean(r && r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight) };
  }), ['#grader-error-msg', '#explain-input', '#retry-grade-btn', '#skip-stop-btn']);
  assert.deepEqual(boxes.filter(b => !b.inside), []);
});

// ===========================================================================
// US3: results can't be loaded
// ===========================================================================

// One correct STOP on line 3, then the end of the run with `complete` failing as given.
async function failedComplete(s, ...behaviors) {
  await s.begin();
  await s.inject('complete', ...behaviors);
  await s.catchLine(3, GOOD[3]);
  const st = await s.playToEnd();
  assert.ok(st.resultsError, `#results-error shown: ${brief(st)}`);
  return st;
}

async function assertResultsErrorState(s, st, { spokenTimes }) {
  assert.equal(await s.text('#results-error-msg'), COPY.resultsError, '#results-error-msg copy');
  assert.equal(await s.text('#retry-results-btn'), 'Retry results');
  assert.equal(st.focus, 'retry-results-btn', 'focus on Retry results');
  assert.equal(await s.visible('#again-btn'), true, 'Run another job visible');
  for (const sel of ['#result-rating', '#result-total', '#missed-list']) {
    const shown = await s.page.evaluate(q => { const el = document.querySelector(q); return Boolean(el?.checkVisibility() && el.innerText.trim()); }, sel);
    assert.equal(shown, false, `${sel} not shown`);
  }
  const spoken = await s.spoken();
  if (spokenTimes === 0) assert.deepEqual(spoken.filter(x => x === COPY.resultsError), []);
  else assert.equal(count(spoken, COPY.resultsError), spokenTimes, 'results-error sentence spoken');
}

// Values of the same run when complete succeeds first time (US3.3): +270, then major and minor missed.
async function assertOneCatchResults(s) {
  const r = await s.results();
  assert.equal(r.rating, 'Back to the classroom');
  assert.equal(r.total, '170');
  assert.equal(r.max, '600');
  assert.equal(r.summary, 'Caught 1 of 3 mistakes · 0 false alarms');
  assert.deepEqual(r.items.map(i => i.text), [missedItem(5), missedItem(7)]);
}

for (const speech of ['voice', 'text']) {
  const v = speech === 'voice';
  const id = (vn, tn) => (v ? vn : tn);

  e2e(`${id('US3.1', 'US3.2')} ${speech}: an aborted complete shows #results-error, focus on Retry results, Run another job visible, no rating, total or missed list`, { speech, todo: 'F1a-T17b' }, async s => {
    const st = await failedComplete(s, 'abort');
    await assertResultsErrorState(s, st, { spokenTimes: v ? 1 : 0 });
    if (!v) assert.deepEqual(await s.spoken(), []);
  });

  e2e(`${id('US3.3', 'US3.4')} ${speech}: Retry results loads the normal results with the values of a first-time success`, { speech, todo: 'F1a-T17b' }, async s => {
    await failedComplete(s, 'abort');
    await s.press('#retry-results-btn');
    const st = await s.until('results after retry', x => x.results || x.resultsError);
    assert.ok(st.results, 'normal results shown');
    await assertOneCatchResults(s);
    await s.drain({ clock: true });
    const spoken = await s.spoken();
    if (v) assert.equal(spoken.at(-1), COPY.happened(MISTAKE[5].consequence), 'run-end line as in US1');
    else assert.deepEqual(spoken, []);
  });

  e2e(`US3.5 ${speech}: Retry results fails again: same copy${v ? ', spoken again' : ''}, focus stays on Retry results`, { speech, todo: 'F1a-T17b' }, async s => {
    await failedComplete(s, 'abort', 'abort');
    await s.drain();
    await s.press('#retry-results-btn');
    const st = await s.until('second results error', x => (x.resultsError && x.focus === 'retry-results-btn') || x.results);
    assert.ok(st.resultsError, 'results error again');
    await assertResultsErrorState(s, st, { spokenTimes: v ? 2 : 0 });
  });

  e2e(`edge: a 409 on complete shows #results-error (${speech})`, { speech, todo: 'F1a-T17b' }, async s => {
    const st = await failedComplete(s, { status: 409, body: { error: 'a STOP is still being graded' } });
    await assertResultsErrorState(s, st, { spokenTimes: v ? 1 : 0 });
  });

  e2e(`${id('US3.7', 'US3.8')} Run another job during a pending complete: results never appear over setup (${speech})`, { speech, todo: 'F1a-T17b' }, async s => {
    await failedComplete(s, 'abort', 'hold');
    await s.drain();
    await s.page.locator('#retry-results-btn').click();
    await s.waitHeld(1);
    const spokenAtAgain = (await s.spoken()).length;
    await s.page.locator('#again-btn').click();
    let st = await s.until('setup during pending complete', x => x.setup, { pending: true });
    await s.releaseHeld();
    st = await s.until('late response handled', () => true);
    await s.drain({ clock: true });
    st = await s.snap();
    assert.equal(st.setup, true, 'setup screen stays');
    assert.equal(st.results || st.resultsError, false, 'no results over setup');
    assert.equal((await s.spoken()).length, spokenAtAgain, 'nothing more spoken');
  });
}

e2e('US3.1 complete client timeout at 12 000 ms shows #results-error', { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await s.begin();
  await s.inject('complete', 'hold');
  await s.catchLine(3, GOOD[3]);
  // Play until the complete request is sent and held (time moves only while nothing is pending).
  for (let ticks = 0; !s.held.length; ticks++) {
    const x = await s.until('playing', () => true);
    if (x.results || x.resultsError) throw new Error(`run ended without a held complete request: ${brief(x)}`);
    if (ticks > MAX_TICKS) throw new Error('stalled');
    await s.runFor(TICK_MS);
    await sleep(5);
  }
  await s.runFor(CLIENT_TIMEOUT_MS - 1, { allowPending: true });
  let st = await s.until('before the timeout', () => true, { pending: true });
  assert.equal(st.resultsError, false, 'no results error at 11 999 ms');
  await s.runFor(1, { allowPending: true });
  st = await s.until('results error after the timeout', x => x.resultsError || x.results);
  assert.ok(st.resultsError, '#results-error at 12 000 ms');
  await assertResultsErrorState(s, st, { spokenTimes: 0 });
  await s.releaseHeld().catch(() => {});
});

e2e('US3.6 focus on #result-rating after a successful Retry results', { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await failedComplete(s, 'abort');
  await s.press('#retry-results-btn');
  const st = await s.until('results after retry', x => x.results || x.resultsError);
  assert.ok(st.results);
  assert.equal(st.focus, 'result-rating');
  assert.equal(await s.page.locator('#result-rating').getAttribute('tabindex'), '-1');
});

e2e('FR-049 results error: role=alert on #results-error-msg, aria-describedby on Retry results', { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await s.goto();
  const a = await s.page.evaluate(() => {
    const $ = id => document.getElementById(id);
    return { role: $('results-error-msg')?.getAttribute('role') ?? null, retry: $('retry-results-btn')?.getAttribute('aria-describedby') ?? null, rating: $('result-rating')?.getAttribute('tabindex') ?? null };
  });
  assert.deepEqual(a, { role: 'alert', retry: 'results-error-msg', rating: '-1' });
});

e2e('FR-049 role=status on #results-note', { speech: 'text', todo: 'F1a-T17d' }, async s => {
  await s.goto();
  assert.equal(await s.page.evaluate(() => document.getElementById('results-note')?.getAttribute('role') ?? null), 'status');
});

e2e('role=alert on both error messages, aria-describedby on their buttons, role=status on #results-note', { speech: 'text', todo: 'F1a-T17d' }, async s => {
  await s.goto();
  const a = await s.page.evaluate(() => {
    const attr = (id, name) => document.getElementById(id)?.getAttribute(name) ?? null;
    const describes = (btn, msg) => (attr(btn, 'aria-describedby') ?? '').split(/\s+/).includes(msg) && Boolean(document.getElementById(msg));
    return {
      graderAlert: attr('grader-error-msg', 'role'), resultsAlert: attr('results-error-msg', 'role'), noteStatus: attr('results-note', 'role'),
      retry: describes('retry-grade-btn', 'grader-error-msg'), skip: describes('skip-stop-btn', 'grader-error-msg'), retryResults: describes('retry-results-btn', 'results-error-msg')
    };
  });
  assert.deepEqual(a, { graderAlert: 'alert', resultsAlert: 'alert', noteStatus: 'status', retry: true, skip: true, retryResults: true });
});

// ===========================================================================
// FR-050: nothing is spoken after "Run another job"
// ===========================================================================

e2e('no speechSynthesis.speak after #again-btn', { speech: 'voice' }, async s => {
  await s.begin();
  const st = await s.playToEnd();
  assert.ok(st.results, 'results shown');
  assert.ok(st.held > 0, 'the run-end line is being spoken');
  await s.page.locator('#again-btn').click();
  await s.until('setup', x => x.setup);
  const n = (await s.spoken()).length;
  await s.drain({ clock: true });
  await s.runFor(5000);
  await s.drain({ clock: true });
  assert.equal((await s.spoken()).length, n, 'no speak() after #again-btn');
});

e2e('no speechSynthesis.speak after #again-btn between the run-end line and the results note', { speech: 'voice', todo: 'F1a-T17d' }, async s => {
  await s.begin();
  await s.inject('stop', 'abort');
  const st0 = await s.stopAndExplain(3, GOOD[3]);
  assert.ok(st0.graderError, 'panel shown');
  await s.skip();
  const st = await s.playToEnd();
  assert.ok(st.results, 'results shown');
  assert.equal((await s.spoken()).at(-1), COPY.happened(MISTAKE[5].consequence), 'the run-end line is being spoken');
  await s.page.locator('#again-btn').click();
  await s.until('setup', x => x.setup);
  const n = (await s.spoken()).length;
  await s.drain({ clock: true });
  await s.runFor(5000);
  await s.drain({ clock: true });
  const later = (await s.spoken()).slice(n);
  assert.deepEqual(later, [], 'the results note is not spoken over the setup screen');
});

// ===========================================================================
// FR-011 / FR-045: what the browser holds and renders
// ===========================================================================

e2e('FR-011 leak check in the browser: no /api/* response before each STOP response holds an answer field (3 STOPs)', { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await s.begin();
  await s.catchLine(1, FALSE_ALARM_SAY);
  await s.catchLine(3, GOOD[3]);
  await s.catchLine(5, GOOD[5]);
  await assertNoLeakBeforeStops(s);
});

e2e('FR-011 localStorage and sessionStorage stay empty through a run', { speech: 'text' }, async s => {
  await s.begin();
  await s.catchLine(3, GOOD[3]);
  await s.playToEnd();
  assert.deepEqual(await s.page.evaluate(() => [localStorage.length, sessionStorage.length]), [0, 0]);
});

e2e('edge: a scenario label containing <b>x</b> is shown literally', { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await s.fulfilJson('/api/scenarios', [{ id: 'electrical', label: '<b>x</b>' }]);
  await s.goto();
  const r = await s.page.evaluate(() => {
    const sel = document.querySelector('#setup-screen select');
    return { text: sel.options[0]?.textContent ?? null, tags: sel.querySelectorAll('b').length };
  });
  assert.deepEqual(r, { text: '<b>x</b>', tags: 0 });
});

e2e("edge: a missed item with severity '<x>' gets no class and shows the text literally", { speech: 'text', todo: 'F1a-T17b' }, async s => {
  await s.begin();
  await s.inject('complete', async route => {
    const res = await route.fetch();
    const json = await res.json();
    json.missed[0].severity = '<x>';
    return route.fulfill({ response: res, json });
  });
  await s.playToEnd();
  const r = await s.results();
  assert.ok(r.items.length > 0, 'missed items shown');
  assert.ok(r.items[0].text.startsWith('<x> · missed · -300 pts '), `severity shown literally: ${r.items[0].text}`);
  assert.deepEqual(r.items[0].cls.filter(c => c !== 'not-graded'), [], 'no class from an unknown severity');
});

// ===========================================================================
// Edge cases and exploratory checks that hold today
// ===========================================================================

e2e('edge: empty explanation on the critical line: Right moment, wrong reason, +38 points, fix appended', { speech: 'text' }, async s => {
  await s.begin();
  await s.playTo(3);
  await s.pressStop();
  await s.submit();
  const st = await s.afterSubmit();
  assert.ok(st.feedback);
  assertFeedback(await s.feedback(), {
    verdict: 'Right moment, wrong reason',
    text: `You stopped at the right moment, but say what is wrong and why. ${MISTAKE[3].why} Here's the right way: ${MISTAKE[3].correctAction}`,
    points: '+38 points'
  });
});

e2e('edge: a 2,500-character explanation is graded and the run continues', { speech: 'text' }, async s => {
  await s.begin();
  const long = (GOOD[3] + '. ').repeat(80).slice(0, 2500);
  assert.equal(long.length, 2500);
  const st = await s.stopAndExplain(3, long);
  assert.ok(st.feedback, 'feedback shown');
  assert.equal((await s.feedback()).source, 'Graded by: keyword grader');
  await s.backToWork();
  const end = await s.playToEnd();
  assert.ok(end.results, 'results shown');
  assert.equal(app.alive(), true, 'server still running');
});

e2e('edge: a second STOP press while explaining opens no second panel and sends nothing', { speech: 'voice' }, async s => {
  await s.begin();
  await s.playTo(3);
  await s.pressStop();
  assert.equal(await s.disabled('#stop-btn'), true, 'STOP disabled while explaining');
  await s.page.locator('#stop-btn').click({ force: true });
  const st = await s.until('still explaining', () => true);
  assert.equal(st.explain, true);
  assert.equal(st.lines.length, 3, 'narration paused on line 3');
  assert.equal(s.requestsOf('stop').length, 0, 'no STOP request before Submit');
});

e2e('edge: Space during the feedback panel does not open a second STOP', { speech: 'text' }, async s => {
  await s.begin();
  const st = await s.stopAndExplain(3, GOOD[3]);
  assert.ok(st.feedback);
  await s.page.locator('#feedback-text').click(); // focus away from the button, so Space can't press it
  await s.page.keyboard.press('Space');
  const after = await s.until('after Space', () => true);
  assert.equal(after.feedback, true, 'feedback still showing');
  assert.equal(after.explain, false, 'no explain panel');
  assert.equal(s.requestsOf('stop').length, 1);
});

e2e('edge: denied mic shows the mic message and a typed answer still submits', { speech: 'voice' }, async s => {
  await s.begin();
  await s.playTo(3);
  await s.pressStop();
  await s.page.locator('#mic-btn').click();
  await s.until('listening', x => x.listening > 0);
  assert.equal(await s.page.evaluate(() => window.__e2e.denyMic()), true);
  const st = await s.until('mic stopped', x => x.listening === 0 && /Talk/.test(x.micLabel));
  assert.match(await s.text('#mic-msg'), /Type your answer instead\.$/);
  assert.equal(st.explain, true, 'explain panel still open');
  await s.page.locator('#explain-input').fill(GOOD[3]);
  await s.page.locator('#submit-btn').click();
  const fb = await s.afterSubmit();
  assert.ok(fb.feedback, 'typed answer graded');
});

e2e('edge: reload mid-session returns to a working setup screen', { speech: 'text' }, async s => {
  await s.begin();
  await s.playTo(2);
  await s.page.reload();
  const st = await s.until('setup after reload', x => x.setup && (x.options > 0 || x.setupMsg !== ''));
  assert.equal(st.play, false, 'no half-played run');
  const first = await s.begin({ goto: false });
  assert.equal(first.lines.length, 1, 'a new run starts');
});

e2e("edge: offline at Start the job shows Couldn't load the job and Start works again", { speech: 'text' }, async s => {
  await s.goto();
  await s.abortPath(p => kindOf(p) === 'start');
  const st = await s.begin({ goto: false });
  assert.ok(st.setupMsg.startsWith("Couldn't load the job: "), `#setup-msg: ${st.setupMsg}`);
  assert.equal(st.startDisabled, false, 'Start the job enabled again');
  await s.page.unrouteAll({ behavior: 'ignoreErrors' });
  const again = await s.begin({ goto: false });
  assert.equal(again.lines.length, 1, 'the job starts once the network is back');
});

// ===========================================================================
// SC-010: both widths in both modes
// ===========================================================================

e2e('SC-010 voice at 1280 px: perfect run, 0 console errors', { speech: 'voice', width: 1280 }, async s => {
  await s.begin();
  for (const n of [3, 5, 7]) await s.catchLine(n, GOOD[n]);
  const st = await s.playToEnd();
  assert.ok(st.results);
  assert.equal((await s.results()).rating, 'Journeyman eyes');
});

e2e('SC-010 text at 390 px: perfect run, explain panel textbox, Talk and Submit inside the viewport', { speech: 'text', width: 390 }, async s => {
  await s.begin();
  await s.playTo(3);
  await s.pressStop();
  const boxes = await s.page.evaluate(sels => sels.map(sel => {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    return { sel, inside: Boolean(r && r.width > 0 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight) };
  }), ['#explain-input', '#mic-btn', '#submit-btn']);
  assert.deepEqual(boxes.filter(b => !b.inside), []);
  await s.explain(GOOD[3]);
  await s.submit();
  assert.ok((await s.afterSubmit()).feedback);
  await s.backToWork();
  for (const n of [5, 7]) await s.catchLine(n, GOOD[n]);
  const st = await s.playToEnd();
  assert.ok(st.results);
  assert.equal((await s.results()).rating, 'Journeyman eyes');
});

// ===========================================================================
// Inv. 7 and the budget
// ===========================================================================

test('inv. 7: the server is still running after the whole suite (budget 10 min)', t => {
  const secs = (Date.now() - suiteStart) / 1000;
  t.diagnostic(`e2e suite time so far: ${secs.toFixed(1)} s; screenshots: ${SHOTS_DIR}`);
  assert.equal(app.alive(), true);
  assert.ok(secs <= 600, `suite took ${secs.toFixed(1)} s (budget 600 s)`);
});
