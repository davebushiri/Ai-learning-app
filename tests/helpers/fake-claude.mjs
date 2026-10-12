// Fake Claude Messages API for testing the live path without a key or network.
//
// In tests:
//   const stub = await startFakeClaude();          // listens on a free port
//   env ANTHROPIC_BASE_URL=stub.url ANTHROPIC_API_KEY=sk-fake
//   stub.setMode({ hang: true }); stub.log; stub.reset(); await stub.close();
//   after(async () => { await assertNoUnroutedCalls(stub); await stub.close(); });
//
// From a shell:
//   STUB_PORT=4599 node tests/helpers/fake-claude.mjs
//   curl -XPOST localhost:4599/__mode -d '{"status":429,"retryAfter":"60"}'
//
// Mode fields (all optional; {} is the happy path):
//   delayMs, hang, status (+ retryAfter, shouldRetry), times (apply to next N requests),
//   stopReason + stopDetails, scenario / grade (objects), scenarioText / gradeText (raw),
//   content (raw content block array), thinkingFirst.
// GET /__log lists every request seen; POST /__reset clears log and mode. Each entry
// also carries `system` (one string; text blocks joined with "\n") and
// `schemaSha256` (of the output schema, null if none) for the golden prompt layer.
// Routing (F1a-T09): the gateway's `x-prompt-id: <promptId>@<VERSION>` header picks the
// response; the entry's `kind` is the part before "@" and `promptId` the whole value.
// A request without the header gets a 500 and `kind: null`, so a misrouted call fails
// loudly (assertNoUnroutedCalls) instead of being served the wrong answer.

import http from 'node:http';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ERROR_TYPES = { 400: 'invalid_request_error', 401: 'authentication_error', 429: 'rate_limit_error', 500: 'api_error', 529: 'overloaded_error' };

// The "generated" card, frozen here (F1a-B08) so the live golden run never depends on a
// product file: today's demo pack electrical card, captured 2026-10-12 after F1a-T07b.
const GENERATED_CARD = Object.freeze(JSON.stringify(
  {
    "id": "electrical-receptacle-01",
    "trade": "electrical",
    "title": "Replace a kitchen countertop receptacle",
    "setting": "Occupied home. Homeowner says the outlet next to the sink is loose and sparks sometimes.",
    "apprentice": "Danny",
    "steps": [
      {
        "id": 1,
        "line": "Alright, outlet by the sink is loose and the homeowner says it sparks sometimes. Easy swap. Heading to the panel in the garage.",
        "error": null
      },
      {
        "id": 2,
        "line": "Breaker's labeled kitchen. Flipping it off.",
        "error": null
      },
      {
        "id": 3,
        "line": "Kitchen lights just went out, so that's the right one. I'm not gonna bother with the tester, it's clearly dead. Back inside.",
        "error": {
          "severity": "critical",
          "summary": "Didn't verify the circuit was dead",
          "why": "Lights going out proves nothing about the receptacle. Countertop outlets are usually on separate small-appliance circuits, and panel labels are often wrong.",
          "correctAction": "Test the tester on a known live outlet, test the receptacle itself, then test the tester again before touching anything. That's live, dead, live.",
          "consequence": "The outlet was on a different breaker. Danny grabbed the hot conductor while pulling the receptacle out and took 120 volts hand to hand while leaning on a grounded sink.",
          "keywords": [
            "test",
            "check",
            "verify",
            "make sure",
            "meter",
            "live",
            "hot",
            "power",
            "off",
            "breaker",
            "circuit",
            "different"
          ]
        }
      },
      {
        "id": 4,
        "line": "Cover plate's off. Backing out the two mounting screws and pulling the receptacle out of the box.",
        "error": null
      },
      {
        "id": 5,
        "line": "Grabbed a fifteen amp tamper-resistant duplex from the truck. It's next to the sink but a regular one's fine, the old one was regular too.",
        "error": {
          "severity": "major",
          "summary": "Installed a non-GFCI receptacle next to a sink",
          "why": "Kitchen countertop receptacles, especially near a sink, need ground fault protection. Replacing like for like doesn't grandfather in a hazard. The fifteen amp rating is fine on a twenty amp kitchen circuit, the protection is what's missing.",
          "correctAction": "Install a GFCI receptacle, or confirm the circuit is already protected by a GFCI upstream, then push the test button to make sure it trips.",
          "consequence": "Months later a wet toaster cord faulted to ground. Without GFCI protection the homeowner got a shock that a GFCI would have tripped in milliseconds.",
          "keywords": [
            "gfci",
            "gfi",
            "ground fault",
            "water",
            "wet",
            "shock",
            "trip",
            "test button",
            "reset",
            "code",
            "protect",
            "sink"
          ]
        }
      },
      {
        "id": 6,
        "line": "Checking the box while it's open. No cracks, and the wires have plenty of length to work with.",
        "error": null
      },
      {
        "id": 7,
        "line": "Old one was wired with the push-in backstab holes. Doing the same on the new one, way faster than the screws.",
        "error": {
          "severity": "minor",
          "summary": "Used backstab connections on a circuit that was already arcing",
          "why": "Push-in backstab connections loosen and heat up over time, and they're only listed for fourteen gauge wire. Kitchen counter circuits are usually twelve gauge. The sparking the homeowner reported was likely a failing backstab.",
          "correctAction": "Wrap each wire clockwise around the side screw terminals, or use the back-wire clamp terminals, and tighten them down to the right torque.",
          "consequence": "The backstab loosened again, and the homeowner called back three weeks later about the same sparking outlet, now scorched.",
          "keywords": [
            "terminal",
            "wrap",
            "loop",
            "clamp",
            "loose",
            "heat",
            "arc",
            "spark",
            "burn",
            "gauge",
            "twelve",
            "torque"
          ]
        }
      },
      {
        "id": 8,
        "line": "Black to brass, white to silver, bare copper to the green ground screw.",
        "error": null
      },
      {
        "id": 9,
        "line": "Folding the wires back in, mounting it, cover plate on.",
        "error": null
      },
      {
        "id": 10,
        "line": "Breaker back on. Plug-in tester shows two ambers, correct wiring. Done.",
        "error": null
      }
    ]
  }
));

export const happyScenario = () => {
  const s = JSON.parse(GENERATED_CARD);
  s.id = 'live-' + s.id;
  s.title = '[LIVE STUB] ' + s.title;
  return s;
};
export const happyGrade = () => ({ verdict: 'correct', reasoningScore: 0.9, feedback: 'Good catch from the stub. Always test before you touch.' });

// SC-007: fails the calling test if fake Claude saw any request without x-prompt-id.
// Async on purpose (F1a-B05): it never throws synchronously; callers await it.
export async function assertNoUnroutedCalls(stub) {
  const log = await (await fetch(`${stub.url}/__log`)).json();
  const bad = log.filter(e => e.kind === null);
  if (bad.length === 0) return;
  throw new assert.AssertionError({
    message: `fake Claude received ${bad.length} unrouted request(s) without x-prompt-id:\n` +
      bad.map(e => `  path=${e.path} promptId=${JSON.stringify(e.promptId ?? null)}`).join('\n'),
    actual: bad, expected: [], operator: 'assertNoUnroutedCalls'
  });
}

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
    const promptId = req.headers['x-prompt-id'] ?? null;
    const kind = promptId ? promptId.split('@')[0] : null;
    const isGrade = kind === 'grade';
    const schema = body.output_config?.format?.schema;
    const system = Array.isArray(body.system)
      ? body.system.filter(b => b?.type === 'text').map(b => b.text).join('\n')
      : body.system ?? null;

    // An unrouted request is answered 500 below and does not use up a `times` slot.
    const active = kind !== null && remaining > 0 ? mode : {};
    if (kind !== null && remaining > 0 && remaining !== Infinity) remaining--;
    n++;
    log.push({
      t: new Date().toISOString(), ms: Date.now(), path: req.url, kind, promptId,
      retryCount: req.headers['x-stainless-retry-count'], beta: req.headers['anthropic-beta'],
      model: body.model, effort: body.output_config?.effort, fallbacks: body.fallbacks,
      max_tokens: body.max_tokens, user: body.messages?.[0]?.content, applied: active,
      system, schemaSha256: schema === undefined ? null : createHash('sha256').update(JSON.stringify(schema)).digest('hex')
    });
    if (!quiet) console.log(`[stub] ${kind} ${req.url} retry=${req.headers['x-stainless-retry-count']} applied=${JSON.stringify(active)}`);

    if (kind === null) {
      return send(500, { type: 'error', error: { type: 'api_error', message: 'stub: missing x-prompt-id' } });
    }
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

// F1a-B09: argv[1] is undefined under `node -e` or stdin; only run the CLI when it is this file.
const isMain = () => {
  if (!process.argv[1]) return false;
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
};
if (isMain()) {
  const stub = await startFakeClaude({
    port: Number(process.env.STUB_PORT) || 4599,
    mode: process.env.STUB_MODE ? JSON.parse(process.env.STUB_MODE) : {},
    quiet: false
  });
  console.log(`[stub] fake Claude on ${stub.url}`);
}
