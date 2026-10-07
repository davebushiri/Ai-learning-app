// Fake Claude Messages API for testing the live path without a key or network.
//
// In tests:
//   const stub = await startFakeClaude();          // listens on a free port
//   env ANTHROPIC_BASE_URL=stub.url ANTHROPIC_API_KEY=sk-fake
//   stub.setMode({ hang: true }); stub.log; stub.reset(); await stub.close();
//
// From a shell:
//   STUB_PORT=4599 node tests/helpers/fake-claude.mjs
//   curl -XPOST localhost:4599/__mode -d '{"status":429,"retryAfter":"60"}'
//
// Mode fields (all optional; {} is the happy path):
//   delayMs, hang, status (+ retryAfter, shouldRetry), times (apply to next N requests),
//   stopReason + stopDetails, scenario / grade (objects), scenarioText / gradeText (raw),
//   content (raw content block array), thinkingFirst.
// GET /__log lists every request seen; POST /__reset clears log and mode.
// Request kind (scenario vs grade) is detected from the json_schema in output_config.

import http from 'node:http';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const FIXTURE = new URL('../../fixtures/scenarios/electrical.json', import.meta.url);
const ERROR_TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };

export const happyScenario = () => {
  const s = JSON.parse(readFileSync(FIXTURE, 'utf8'));
  s.id = 'live-' + s.id;
  s.title = '[LIVE STUB] ' + s.title;
  return s;
};
export const happyGrade = () => ({ verdict: 'correct', reasoningScore: 0.9, feedback: 'Good catch from the stub. Always test before you touch.' });

export async function startFakeClaude({ port = 0, mode: initialMode = {}, quiet = true } = {}) {
  let mode = initialMode;
  let remaining = mode.times ?? Infinity;
  let log = [];
  let n = 0;

  const setMode = m => {
    mode = m ?? {};
    remaining = mode.times ?? Infinity;
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    let raw = '';
    for await (const c of req) raw += c;
    const send = (status, obj, headers = {}) => {
      if (res.destroyed) return;
      res.writeHead(status, { 'content-type': 'application/json', 'request-id': 'req_stub_' + n, ...headers });
      res.end(JSON.stringify(obj));
    };

    if (url.pathname === '/__mode' && req.method === 'POST') {
      setMode(raw ? JSON.parse(raw) : {});
      return send(200, { ok: true, mode });
    }
    if (url.pathname === '/__mode') return send(200, mode);
    if (url.pathname === '/__log') return send(200, log);
    if (url.pathname === '/__reset') {
      log = [];
      setMode({});
      return send(200, { ok: true });
    }
    if (url.pathname !== '/v1/messages' || req.method !== 'POST') {
      return send(404, { type: 'error', error: { type: 'not_found_error', message: `stub: no route ${req.method} ${req.url}` } });
    }

    let body = {};
    try { body = JSON.parse(raw); } catch {}
    const isGrade = JSON.stringify(body.output_config?.format?.schema ?? {}).includes('verdict');
    const kind = isGrade ? 'grade' : 'scenario';

    const active = remaining > 0 ? mode : {};
    if (remaining > 0 && remaining !== Infinity) remaining--;
    n++;
    log.push({
      t: new Date().toISOString(), ms: Date.now(), path: req.url, kind,
      retryCount: req.headers['x-stainless-retry-count'], beta: req.headers['anthropic-beta'],
      model: body.model, effort: body.output_config?.effort, fallbacks: body.fallbacks,
      max_tokens: body.max_tokens, user: body.messages?.[0]?.content, applied: active
    });
    if (!quiet) console.log(`[stub] ${kind} ${req.url} retry=${req.headers['x-stainless-retry-count']} applied=${JSON.stringify(active)}`);

    if (active.hang) return; // never answer
    if (active.delayMs) await new Promise(r => setTimeout(r, active.delayMs));

    if (active.status) {
      const headers = active.retryAfter ? { 'retry-after': String(active.retryAfter) } : {};
      if (active.shouldRetry !== undefined) headers['x-should-retry'] = String(active.shouldRetry);
      return send(active.status, { type: 'error', error: { type: ERROR_TYPES[active.status] ?? 'api_error', message: `stub ${active.status}` } }, headers);
    }

    let content = active.content;
    if (!content) {
      const text = isGrade
        ? active.gradeText ?? JSON.stringify(active.grade ?? happyGrade())
        : active.scenarioText ?? JSON.stringify(active.scenario ?? happyScenario());
      content = [{ type: 'text', text }];
      if (active.thinkingFirst) content.unshift({ type: 'thinking', thinking: 'Let me think about this.', signature: 'sig_stub' });
    }
    send(200, {
      id: 'msg_stub_' + n, type: 'message', role: 'assistant', model: 'claude-opus-5-5', content,
      stop_reason: active.stopReason ?? 'end_turn', stop_sequence: null, stop_details: active.stopDetails ?? null,
      usage: { input_tokens: 1234, output_tokens: 321 }
    });
  });

  await new Promise(r => server.listen(port, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}`;
  return {
    url,
    get log() { return log; },
    setMode,
    reset() { log = []; setMode({}); },
    close() {
      server.closeAllConnections(); // hung requests would otherwise keep it open
      return new Promise(r => server.close(r));
    }
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const stub = await startFakeClaude({
    port: Number(process.env.STUB_PORT) || 4599,
    mode: process.env.STUB_MODE ? JSON.parse(process.env.STUB_MODE) : {},
    quiet: false
  });
  console.log(`[stub] fake Claude on ${stub.url}`);
}
