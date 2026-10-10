// Tiny zero-framework server: serves the web page and three JSON endpoints.
//
//   GET  /api/health                      -> { mode, lastLiveOkAt, lastLiveError }
//   GET  /api/trades                      -> [{ id, label }]
//   GET  /api/scenario?trade=electrical   -> Scenario   (&source=fixture forces the cached one)
//   POST /api/grade  GradeRequest         -> GradeResponse
//
// MOCK mode (no ANTHROPIC_API_KEY, or MOCK=1) serves fixtures and keyword grading,
// so the frontend and scoring can be built without an API key.
//
// Handlers live in server/routes/*, logic in server/services/*. This file keeps
// env loading, the [api] log line, dispatch, 404 / error handling and listen.

import http from 'node:http';
import path from 'node:path';
import { ROOT, HttpError, sendJson, serveStatic } from './http.js';

try {
  process.loadEnvFile(path.join(ROOT, '.env'));
} catch {
  // no .env file: fine, MOCK mode or real env vars
}
const PORT = /^\d+$/.test(process.env.PORT ?? '') ? Number(process.env.PORT) : 3000; // 0 = any free port

// A bad request must never take the demo down.
process.on('unhandledRejection', err => console.error('[unhandled]', err));

// Imported only after .env is loaded: ai-client.js and llm.js read the environment
// when they are first evaluated, and static imports would run before loadEnvFile.
const { MOCK } = await import('./services/ai-client.js');
const ROUTES = (await Promise.all([
  import('./routes/health.js'),
  import('./routes/scenarios.js'),
  import('./routes/grade.js')
])).map(m => m.handle);

const server = http.createServer(async (req, res) => {
  const t0 = Date.now();
  try {
    // The host header is never needed (and can be garbage), so don't parse it.
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      res.on('finish', () => console.log(`[api] ${req.method} ${url.pathname} ${res.statusCode} ${res.apiSource ?? '-'} ${Date.now() - t0} ms`));
    }
    for (const handle of ROUTES) {
      if (await handle(req, res, url)) return;
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
