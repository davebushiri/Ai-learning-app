// Tiny zero-framework server: serves the web page and three JSON endpoints.
//
//   GET  /api/health                      -> { mode, lastLiveOkAt, lastLiveError }
//   GET  /api/trades                      -> [{ id, label }]
//   GET  /api/scenario?trade=electrical   -> Scenario   (&source=fixture forces the cached one)
//   POST /api/grade  GradeRequest         -> GradeResponse
//
// MOCK mode (no ANTHROPIC_API_KEY, or MOCK=1) serves fixtures and keyword grading,
// so the frontend and scoring can be built without an API key.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TRADES, listTrades } from './prompts/trades.js';
import { validateScenario, clampGrade } from '../shared/contract.js';
import { mockGrade } from '../shared/mock-grader.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // no .env file: fine, MOCK mode or real env vars
}
const PORT = /^\d+$/.test(process.env.PORT ?? '') ? Number(process.env.PORT) : 3000; // 0 = any free port
const MOCK = process.env.MOCK === '1' || !process.env.ANTHROPIC_API_KEY;
const MAX_BODY_BYTES = 1_000_000;
const MAX_EXPLANATION_CHARS = 2000;

// A bad request must never take the demo down.
process.on('unhandledRejection', err => console.error('[unhandled]', err));

// Only load the SDK when we actually need it.
const llm = MOCK ? null : await import('./llm.js');

const STATIC_DIRS = { '/shared/': 'shared', '/': 'web' };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png'
};

// What /api/health reports about the live path, so a bad key doesn't hide behind "LIVE".
const liveStatus = { lastLiveOkAt: null, lastLiveError: null };
function noteLive(what, err) {
  const at = new Date().toISOString();
  if (err) liveStatus.lastLiveError = `${at} ${what}: ${err.message}`;
  else liveStatus.lastLiveOkAt = at;
}

// Thrown for bad client input; the handler turns it into that status code.
class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function loadFixture(tradeId) {
  const file = path.join(ROOT, 'fixtures', 'scenarios', TRADES[tradeId].fixture);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function getScenario(tradeId, source) {
  if (MOCK || source === 'fixture') return { scenario: await loadFixture(tradeId), source: 'fixture' };
  try {
    const scenario = await llm.generateScenario(tradeId, TRADES[tradeId]);
    if (scenario && typeof scenario === 'object') {
      // We asked for this trade; don't trust the model to echo it back.
      scenario.trade = tradeId;
      scenario.id ||= `live-${tradeId}-${Date.now()}`;
    }
    const problems = validateScenario(scenario);
    if (problems.length) throw new Error(`invalid scenario: ${problems.join('; ')}`);
    noteLive('scenario');
    return { scenario, source: 'live' };
  } catch (err) {
    noteLive('scenario', err);
    console.warn(`[scenario] live generation failed, using fixture: ${err.message}`);
    return { scenario: await loadFixture(tradeId), source: 'fixture-fallback' };
  }
}

async function grade(body) {
  const { scenario, stepId } = body;
  const explanation = String(body.explanation ?? '').slice(0, MAX_EXPLANATION_CHARS);
  // A STOP only counts as a catch if it targets a step that really has a mistake.
  const target = body.errorStepId ?? null;
  const errorStepId = target !== null && scenario.steps.some(s => s.id === target && s.error) ? target : null;
  if (MOCK) return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock' };
  try {
    // False alarms go to Claude too, so the learner hears why the step was fine.
    const g = clampGrade(await llm.gradeExplanation({ scenario, stepId, errorStepId, explanation }));
    if (!g.feedback.trim()) throw new Error('Claude returned empty feedback');
    // The server, not the model, decides whether this was a false alarm.
    if (errorStepId === null) g.verdict = 'false_alarm';
    else if (g.verdict === 'false_alarm') g.verdict = 'wrong';
    noteLive('grade');
    return { ...g, source: 'live' };
  } catch (err) {
    noteLive('grade', err);
    console.warn(`[grade] live grading failed, using keyword grader: ${err.message}`);
    return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock-fallback' };
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let bytes = 0;
  // Keep draining past the limit so the client gets the 413 instead of a reset.
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (bytes > MAX_BODY_BYTES) throw new HttpError(413, 'body too large');
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new HttpError(400, 'body is not valid JSON');
  }
}

async function serveStatic(res, pathname) {
  const prefix = Object.keys(STATIC_DIRS).find(p => pathname.startsWith(p));
  const base = path.join(ROOT, STATIC_DIRS[prefix]);
  const rel = pathname.slice(prefix.length) || 'index.html';
  const file = path.resolve(base, rel);
  if (!file.startsWith(base + path.sep)) return sendJson(res, 403, { error: 'forbidden' });
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    sendJson(res, 404, { error: 'not found' });
  }
}

const isObject = v => v !== null && typeof v === 'object';

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  let source = '-';
  try {
    // The host header is never needed (and can be garbage), so don't parse it.
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.on('finish', () => console.log(`[api] ${req.method} ${url.pathname} ${res.statusCode} ${source} ${Date.now() - t0} ms`));
    }
    if (url.pathname === '/api/health') return sendJson(res, 200, { mode: MOCK ? 'mock' : 'live', ...liveStatus });
    if (url.pathname === '/api/trades') return sendJson(res, 200, listTrades());
    if (url.pathname === '/api/scenario') {
      const trade = url.searchParams.get('trade') || 'electrical';
      if (!Object.hasOwn(TRADES, trade)) return sendJson(res, 400, { error: `unknown trade ${trade}` });
      const result = await getScenario(trade, url.searchParams.get('source'));
      source = result.source;
      return sendJson(res, 200, { ...result.scenario, source });
    }
    if (url.pathname === '/api/grade' && req.method === 'POST') {
      const body = await readBody(req);
      const steps = body?.scenario?.steps;
      if (!Array.isArray(steps) || !steps.every(isObject)) return sendJson(res, 400, { error: 'scenario with steps required' });
      const result = await grade(body);
      source = result.source;
      return sendJson(res, 200, result);
    }
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    return await serveStatic(res, url.pathname);
  } catch (err) {
    if (err instanceof HttpError) return sendJson(res, err.status, { error: err.message });
    if (err instanceof TypeError && err.code === 'ERR_INVALID_URL') return sendJson(res, 400, { error: 'bad url' });
    console.error(err);
    if (res.headersSent) return res.end();
    return sendJson(res, 500, { error: 'server error' });
  }
});

server.listen(PORT, () => {
  console.log(`Stop the Apprentice on http://localhost:${server.address().port}  (${MOCK ? 'MOCK mode: fixtures + keyword grading' : 'LIVE mode: Claude'})`);
});
