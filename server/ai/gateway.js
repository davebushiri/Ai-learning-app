// The AI gateway (ADR 0005 + Amendments 1 and 2). Every model call goes through run():
// one call site, a hard deadline, a required non-AI fallback, and exactly one llm_call row.

import { createHash } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL } from './models.js';
import { newId } from '../../shared/events.js';

// With server-side fallback, a `fallback` block marks where a declining model's
// output stops and the next model's starts. Only the text after the last one counts.
export function responseText(content = []) {
  const start = content.findLastIndex(b => b.type === 'fallback') + 1;
  return content.slice(start).filter(b => b.type === 'text').map(b => b.text).join('');
}

// sha256 of system, schema and every fingerprint render: any text change moves it (inv. 4).
export function promptFingerprint(PROMPT) {
  const h = createHash('sha256');
  h.update(PROMPT.system);
  h.update(JSON.stringify(PROMPT.schema));
  for (const i of PROMPT.fingerprintInputs) h.update(PROMPT.render(i));
  return h.digest('hex');
}

// A failure that ends the live attempt with a known outcome and a short reason.
class Fail {
  constructor(outcome, error) {
    this.outcome = outcome;
    this.error = error;
  }
}

function checkArgs(prompt, fallback) {
  if (typeof fallback !== 'function') throw new TypeError('run() needs a fallback function');
  const id = prompt?.PROMPT?.id;
  if (typeof id !== 'string' || !id) throw new TypeError('run() needs prompt.PROMPT.id, a non-empty string');
  if (!Number.isInteger(prompt.VERSION) || prompt.VERSION < 1) {
    throw new TypeError(`prompt ${id} needs an integer VERSION >= 1`);
  }
}

export function createGateway({ client, logCall }) {
  function log(row) {
    // Logging must never change what the learner gets.
    try {
      logCall(row);
    } catch (err) {
      console.warn(`[gateway] llm_call log failed: ${err?.message ?? err}`);
    }
  }

  async function callLive({ PROMPT, promptVersion, input, effort, deadlineMs, normalize, accept }) {
    const t0 = Date.now();
    let response;
    try {
      response = await client.beta.messages.create(
        {
          model: MODEL,
          max_tokens: 16000,
          system: PROMPT.system,
          messages: [{ role: 'user', content: PROMPT.render(input) }],
          output_config: { effort, format: { type: 'json_schema', schema: PROMPT.schema } },
          // If a safety classifier declines, the API retries on a fallback model
          // instead of failing the session.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default'
        },
        // A signal (not `timeout`) also caps the SDK's retry-after sleeps.
        { signal: AbortSignal.timeout(deadlineMs), maxRetries: 1, headers: { 'x-prompt-id': promptVersion } }
      );
    } catch (err) {
      const ms = Date.now() - t0;
      console.warn(`[claude] ${PROMPT.id} failed after ${ms} ms status=${err?.status ?? '-'} request=${err?.requestID ?? '-'}: ${err?.message}`);
      // Typed class, never message text: a hang or a retry-after past the deadline.
      if (err instanceof Anthropic.APIUserAbortError) {
        return { ms, fail: new Fail('timeout', `Claude ${PROMPT.id} timed out after ${deadlineMs} ms`) };
      }
      return { ms, fail: new Fail('fallback', String(err?.message ?? err)) };
    }

    const ms = Date.now() - t0;
    const { model, stop_reason, usage, id } = response;
    console.log(`[claude] ${PROMPT.id} ${ms} ms ${model} ${stop_reason} ${usage?.input_tokens}/${usage?.output_tokens} tokens ${id}`);
    try {
      if (stop_reason === 'refusal') {
        throw new Fail('refusal', `Claude declined: ${response.stop_details?.category ?? 'unknown'}`);
      }
      // A cut-off answer can still parse, but it isn't the whole answer.
      if (stop_reason === 'max_tokens') throw new Fail('fallback', 'Claude response was cut off (max_tokens)');
      const text = responseText(response.content);
      if (!text) throw new Fail('fallback', 'Claude returned no text');
      const data = normalize(JSON.parse(text));
      const problems = accept(data) ?? [];
      if (problems.length) throw new Fail('fallback', problems.join('; '));
      return { ms, response, data };
    } catch (err) {
      return { ms, response, fail: err instanceof Fail ? err : new Fail('fallback', String(err?.message ?? err)) };
    }
  }

  async function run({ prompt, input, live, effort, deadlineMs, normalize = d => d, accept = () => [], fallback }) {
    checkArgs(prompt, fallback);
    const { PROMPT } = prompt;
    const promptVersion = `${PROMPT.id}@${prompt.VERSION}`;
    const at = new Date().toISOString();

    let result;
    if (!live) {
      result = { ms: 0, outcome: 'mock', source: 'mock', error: null };
    } else {
      let attempt;
      try {
        attempt = await callLive({ PROMPT, promptVersion, input, effort, deadlineMs, normalize, accept });
      } catch (err) {
        // Only a bug in this module gets here; still degrade rather than crash.
        attempt = { ms: Date.now() - Date.parse(at), fail: new Fail('fallback', String(err?.message ?? err)) };
      }
      const { ms, response, fail, data } = attempt;
      result = fail
        ? { ms, response, outcome: fail.outcome, source: 'fallback', error: fail.error }
        : { ms, response, outcome: 'ok', source: 'live', error: null, data };
    }

    const usage = result.response?.usage;
    const model = result.response?.model ?? MODEL;
    // Logged before fallback() runs, so a throwing fallback still leaves its row.
    log({
      id: newId('llm'), at, pipeline: PROMPT.id, prompt_version: promptVersion, model, ms: result.ms,
      input_tokens: usage?.input_tokens ?? 0, output_tokens: usage?.output_tokens ?? 0,
      cache_read: usage?.cache_read_input_tokens ?? 0, cost_usd: null, outcome: result.outcome
    });

    const data = result.outcome === 'ok' ? result.data : await fallback();
    return {
      data,
      source: result.source,
      meta: { promptVersion, model, ms: result.ms, outcome: result.outcome, error: result.error }
    };
  }

  return { run };
}
