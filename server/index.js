// Tiny zero-framework server: serves the web page and three JSON endpoints.
//
//   GET  /api/health                      -> { mode }
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
const PORT = Number(process.env.PORT) || 3000;
const MOCK = process.env.MOCK === '1' || !process.env.ANTHROPIC_API_KEY;

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

async function loadFixture(tradeId) {
  const file = path.join(ROOT, 'fixtures', 'scenarios', TRADES[tradeId].fixture);
  return JSON.parse(await readFile(file, 'utf8'));
}

async function getScenario(tradeId, source) {
  if (MOCK || source === 'fixture') return { scenario: await loadFixture(tradeId), source: 'fixture' };
  try {
    const scenario = await llm.generateScenario(tradeId, TRADES[tradeId]);
    const problems = validateScenario(scenario);
    if (problems.length) throw new Error(`invalid scenario: ${problems.join('; ')}`);
    return { scenario, source: 'live' };
  } catch (err) {
    console.warn(`[scenario] live generation failed, using fixture: ${err.message}`);
    return { scenario: await loadFixture(tradeId), source: 'fixture-fallback' };
  }
}

async function grade(body) {
  const { scenario, stepId, errorStepId = null, explanation = '' } = body;
  // No mistake targeted means it's a false alarm; no need to spend an LLM call deciding that.
  if (MOCK || errorStepId === null) return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock' };
  try {
    const g = await llm.gradeExplanation({ scenario, stepId, errorStepId, explanation });
    return { ...clampGrade(g), source: 'live' };
  } catch (err) {
    console.warn(`[grade] live grading failed, using keyword grader: ${err.message}`);
    return { ...mockGrade(scenario, errorStepId, explanation), source: 'mock-fallback' };
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': MIME['.json'] });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('body too large');
  }
  return JSON.parse(raw || '{}');
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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname === '/api/health') return sendJson(res, 200, { mode: MOCK ? 'mock' : 'live' });
    if (url.pathname === '/api/trades') return sendJson(res, 200, listTrades());
    if (url.pathname === '/api/scenario') {
      const trade = url.searchParams.get('trade') || 'electrical';
      if (!TRADES[trade]) return sendJson(res, 400, { error: `unknown trade ${trade}` });
      const { scenario, source } = await getScenario(trade, url.searchParams.get('source'));
      return sendJson(res, 200, { ...scenario, source });
    }
    if (url.pathname === '/api/grade' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.scenario?.steps) return sendJson(res, 400, { error: 'scenario required' });
      return sendJson(res, 200, await grade(body));
    }
    if (url.pathname.startsWith('/api/')) return sendJson(res, 404, { error: 'not found' });
    return serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message });
  }
});

server.listen(PORT, () => {
  console.log(`Stop the Apprentice on http://localhost:${PORT}  (${MOCK ? 'MOCK mode: fixtures + keyword grading' : 'LIVE mode: Claude'})`);
});
